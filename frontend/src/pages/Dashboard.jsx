import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import api from '../services/api';
import toast from 'react-hot-toast';

import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import AISummary from '../components/dashboard/AISummary';
import HealthScore from '../components/dashboard/HealthScore';
import LiveLogs from '../components/dashboard/LiveLogs';
import MetricsCards from '../components/dashboard/MetricsCards';
import Charts from '../components/dashboard/Charts';
import AlertsPanel from '../components/dashboard/AlertsPanel';
import TracePanel from '../components/dashboard/TracePanel';
import AISuggestions from '../components/dashboard/AISuggestions';
import SimulationPanel from '../components/dashboard/SimulationPanel';
import IssuesPanel from '../components/dashboard/IssuesPanel';

export default function Dashboard() {
  const { projectId } = useParams();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [activeProject, setActiveProject] = useState(null);
  const [overview, setOverview] = useState(null);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [issues, setIssues] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');

  const currentProjectId = activeProject?.projectId;

  // Load projects
  useEffect(() => {
    api.get('/projects').then(res => {
      setProjects(res.data.projects);
      if (!activeProject && res.data.projects.length > 0) {
        const target = projectId
          ? res.data.projects.find(p => p.projectId === projectId) || res.data.projects[0]
          : res.data.projects[0];
        setActiveProject(target);
      }
    }).catch(() => {});
  }, []);

  // Load project data
  useEffect(() => {
    if (!activeProject) { setLoading(false); return; }
    const pid = activeProject.projectId;
    setLoading(true);

    Promise.all([
      api.get(`/dashboard/${pid}/overview`),
      api.get(`/dashboard/${pid}/logs?limit=100`),
      api.get(`/dashboard/${pid}/metrics`),
      api.get(`/dashboard/${pid}/issues`),
      api.get(`/alerts?projectId=${pid}&limit=30`),
      api.get(`/dashboard/${pid}/chart-data`)
    ]).then(([ov, lg, mt, is, al, ch]) => {
      setOverview(ov.data);
      setLogs(lg.data.logs);
      setMetrics(mt.data);
      setIssues(is.data.issues);
      setAlerts(al.data.alerts);
      setChartData(ch.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [activeProject]);

  // AI analysis result (computed server-side via Groq, pushed over the socket)
  const handleAiInsight = useCallback((insight) => {
    const { issueId } = insight;
    setAiInsights(prev => [insight, ...prev.slice(0, 9)]);
    setIssues(prev => prev.map(i => i._id === issueId ? { ...i, aiAnalysis: insight } : i));
  }, []);

  // Daily report (AI summary already computed server-side)
  const handleReport = useCallback(({ aiSummary: summary }) => {
    if (summary) setAiSummary(summary);
  }, []);

  // Socket real-time updates
  useSocket(currentProjectId, {
    onLog: (log) => setLogs(prev => [log, ...prev].slice(0, 200)),
    onMetric: (metric) => setMetrics(prev => prev ? { ...prev, metrics: [metric, ...(prev.metrics || [])].slice(0, 500) } : prev),
    onIssue: (issue) => {
      setIssues(prev => [issue, ...prev]);
      toast.error(`🚨 Issue: ${issue.title}`, { duration: 5000 });
    },
    onAlert: (alert) => {
      setAlerts(prev => [alert, ...prev]);
      toast.error(`⚠️ ${alert.message}`, { duration: 6000 });
    },
    onHealth: ({ healthScore, status }) => {
      setOverview(prev => prev ? { ...prev, healthScore, status } : prev);
    },
    onAiInsight: handleAiInsight,
    onReport: handleReport
  });

  const switchProject = (project) => {
    setActiveProject(project);
    navigate(`/dashboard/${project.projectId}`);
  };

  if (loading && !activeProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!projects.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">No projects yet</h2>
          <p className="text-slate-400 mb-6">Create your first project to start monitoring.</p>
          <button onClick={() => navigate('/setup')} className="btn-primary">Create Project →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        onSelectProject={switchProject}
        user={user}
        onLogout={logout}
        onNewProject={() => navigate('/setup')}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header project={activeProject} overview={overview} />

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Top row: AI Summary + Health Score */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <AISummary
                project={activeProject}
                overview={overview}
                aiSummary={aiSummary}
                onGenerateSummary={async () => {
                  if (!overview) return;
                  const res = await api.post(`/dashboard/${currentProjectId}/ai-summary`, {
                    overview,
                    topIssues: issues.slice(0, 5)
                  });
                  setAiSummary(res.data.summary);
                }}
              />
            </div>
            <HealthScore overview={overview} />
          </div>

          {/* Middle: Logs + Metrics + Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
            {/* Left: Live Logs */}
            <div className="xl:col-span-4">
              <LiveLogs logs={logs} />
            </div>

            {/* Center: Metrics + Charts */}
            <div className="xl:col-span-5 space-y-4">
              <MetricsCards overview={overview} />
              <Charts chartData={chartData} />
            </div>

            {/* Right: Alerts + Trace + AI */}
            <div className="xl:col-span-3 space-y-4">
              <AlertsPanel alerts={alerts} onMarkRead={async (id) => {
                await api.put(`/alerts/${id}/read`);
                setAlerts(prev => prev.map(a => a._id === id ? { ...a, read: true } : a));
              }} />
              <TracePanel issues={issues} project={activeProject} />
            </div>
          </div>

          {/* Issues + AI Suggestions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IssuesPanel issues={issues} onResolve={async (id) => {
              await api.put(`/dashboard/${currentProjectId}/issues/${id}/resolve`);
              setIssues(prev => prev.map(i => i._id === id ? { ...i, resolved: true } : i));
              toast.success('Issue resolved');
            }} />
            <AISuggestions insights={aiInsights} />
          </div>

          {/* Bottom: Simulation */}
          <SimulationPanel project={activeProject} />
        </div>
      </div>
    </div>
  );
}
