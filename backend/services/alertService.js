const nodemailer = require('nodemailer');
const Alert = require('../models/Alert');
const { emitToProject } = require('../socket/socketHandler');

const getTransporter = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const createAlert = async (project, issue) => {
  try {
    const alert = await Alert.create({
      projectId: project.projectId,
      type: issue.type,
      severity: issue.severity === 'critical' ? 'critical' : 'warning',
      message: issue.title,
      details: {
        issueId: issue._id,
        endpoint: issue.endpoint,
        traceFile: issue.traceFile
      }
    });

    emitToProject(project.projectId, 'alert-new', alert);

    // Send email for critical alerts
    if (alert.severity === 'critical' && project.alertEmail) {
      await sendAlertEmail(project, alert);
      alert.emailSent = true;
      await alert.save();
    }

    return alert;
  } catch (err) {
    console.error('Alert creation error:', err.message);
  }
};

const sendAlertEmail = async (project, alert) => {
  const transporter = getTransporter();
  if (!transporter) return;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'AutoQual AI+ <noreply@autoqual.dev>',
      to: project.alertEmail,
      subject: `🚨 [${project.name}] Critical Alert: ${alert.message}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #ef4444;">🚨 Critical Issue Detected</h2>
          <p><strong>Project:</strong> ${project.name}</p>
          <p><strong>Issue:</strong> ${alert.message}</p>
          <p><strong>Type:</strong> ${alert.type}</p>
          <p><strong>Severity:</strong> ${alert.severity}</p>
          ${alert.details?.endpoint ? `<p><strong>Endpoint:</strong> ${alert.details.endpoint}</p>` : ''}
          ${alert.details?.traceFile ? `<p><strong>File:</strong> ${alert.details.traceFile}</p>` : ''}
          <p><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
          <hr />
          <p style="color: #6b7280; font-size: 12px;">AutoQual AI+ — Code-Aware Quality Intelligence Platform</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

const sendReportEmail = async (emails, project, report) => {
  const transporter = getTransporter();
  if (!transporter || !emails?.length) return;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'AutoQual AI+ <noreply@autoqual.dev>',
      to: emails.join(', '),
      subject: `📊 [${project.name}] Daily Health Report — ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px;">
          <h2 style="color: #6366f1;">📊 Daily Health Report</h2>
          <p><strong>Project:</strong> ${project.name}</p>
          <p><strong>Period:</strong> ${new Date(report.period.start).toLocaleDateString()} – ${new Date(report.period.end).toLocaleDateString()}</p>

          <h3>Key Metrics</h3>
          <table style="border-collapse: collapse; width: 100%;">
            <tr><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">Health Score</td><td style="padding: 4px 8px; border: 1px solid #e5e7eb;"><strong>${report.stats.healthScore}/100</strong></td></tr>
            <tr><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">Total Requests</td><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${report.stats.totalRequests}</td></tr>
            <tr><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">Error Rate</td><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${report.stats.errorRate}%</td></tr>
            <tr><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">Avg Response Time</td><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${report.stats.avgResponseTime}ms</td></tr>
            <tr><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">Active Issues</td><td style="padding: 4px 8px; border: 1px solid #e5e7eb;">${report.stats.issueCount}</td></tr>
          </table>

          ${report.aiSummary ? `<h3>AI Summary</h3><p>${report.aiSummary}</p>` : ''}

          <hr />
          <p style="color: #6b7280; font-size: 12px;">AutoQual AI+ — Code-Aware Quality Intelligence Platform</p>
        </div>
      `
    });
  } catch (err) {
    console.error('Report email error:', err.message);
  }
};

module.exports = { createAlert, sendAlertEmail, sendReportEmail };
