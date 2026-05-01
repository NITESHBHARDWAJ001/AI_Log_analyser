const cron = require('node-cron');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Log = require('../models/Log');
const Metric = require('../models/Metric');
const Issue = require('../models/Issue');
const Report = require('../models/Report');
const { sendReportEmail } = require('./alertService');
const { buildDailyReportPrompt } = require('./aiService');
const { emitToProject } = require('../socket/socketHandler');

const generateReport = async (projectId) => {
  const end = new Date();
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalLogs, errorLogs, warnLogs, totalMetrics, project, topIssues] = await Promise.all([
    Log.countDocuments({ projectId, timestamp: { $gte: start } }),
    Log.countDocuments({ projectId, level: { $in: ['error', 'fatal'] }, timestamp: { $gte: start } }),
    Log.countDocuments({ projectId, level: 'warn', timestamp: { $gte: start } }),
    Metric.countDocuments({ projectId, timestamp: { $gte: start } }),
    Project.findOne({ projectId }),
    Issue.find({ projectId, lastSeen: { $gte: start } }).sort({ count: -1 }).limit(5)
  ]);

  const errorMetrics = await Metric.countDocuments({ projectId, statusCode: { $gte: 400 }, timestamp: { $gte: start } });
  const avgResponseAgg = await Metric.aggregate([
    { $match: { projectId, timestamp: { $gte: start }, responseTime: { $exists: true } } },
    { $group: { _id: null, avg: { $avg: '$responseTime' } } }
  ]);

  const resolvedIssues = await Issue.countDocuments({ projectId, resolved: true, resolvedAt: { $gte: start } });

  const stats = {
    totalLogs,
    errorLogs,
    warnLogs,
    totalRequests: totalMetrics,
    avgResponseTime: Math.round(avgResponseAgg[0]?.avg || 0),
    errorRate: totalMetrics > 0 ? Math.round((errorMetrics / totalMetrics) * 100 * 100) / 100 : 0,
    issueCount: topIssues.filter(i => !i.resolved).length,
    resolvedIssues,
    healthScore: project?.healthScore || 100
  };

  // Get AI summary prompt (emitted to UI for processing)
  const aiPrompt = buildDailyReportPrompt(stats, topIssues);

  const report = await Report.create({
    projectId,
    teamId: project?.team,
    period: { start, end },
    stats,
    topIssues: topIssues.map(i => ({ title: i.title, severity: i.severity, count: i.count })),
    aiSummary: 'Pending AI analysis...' // updated when UI responds
  });

  // Emit report generated event with AI prompt
  emitToProject(projectId, 'report-generated', {
    reportId: report._id,
    stats,
    aiPrompt
  });

  // Send report email (without AI summary initially)
  if (project?.alertEmail) {
    const team = await Team.findById(project.team).populate('members.user', 'email');
    const emails = team ? [project.alertEmail, ...team.members.map(m => m.email).filter(Boolean)] : [project.alertEmail];
    await sendReportEmail([...new Set(emails)], project, report);
    await Report.findByIdAndUpdate(report._id, { emailSent: true });
  }

  return report;
};

const startReportScheduler = () => {
  const cronExpression = process.env.REPORT_CRON || '0 8 * * *';
  cron.schedule(cronExpression, async () => {
    console.log('📊 Running daily report generation...');
    try {
      const projects = await Project.find({ status: { $ne: 'inactive' } });
      for (const project of projects) {
        await generateReport(project.projectId);
      }
    } catch (err) {
      console.error('Report scheduler error:', err.message);
    }
  });
  console.log(`📅 Report scheduler started (${cronExpression})`);
};

module.exports = { generateReport, startReportScheduler };
