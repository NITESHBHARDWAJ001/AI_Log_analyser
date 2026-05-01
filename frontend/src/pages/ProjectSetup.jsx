import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

const steps = ['Team', 'Project', 'Integration'];

export default function ProjectSetup() {
  const [step, setStep] = useState(0);
  const [teamData, setTeamData] = useState({ name: '', members: '' });
  const [projectData, setProjectData] = useState({ name: '', baseUrl: '', description: '', alertEmail: '' });
  const [createdTeam, setCreatedTeam] = useState(null);
  const [createdProject, setCreatedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const createTeam = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const members = teamData.members.split(',').map(s => s.trim()).filter(Boolean);
      const res = await api.post('/teams', { name: teamData.name, members });
      setCreatedTeam(res.data.team);
      toast.success('Team created!');
      setStep(1);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/projects', {
        ...projectData,
        teamId: createdTeam._id
      });
      setCreatedProject(res.data.project);
      toast.success('Project created!');
      setStep(2);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${i <= step ? 'bg-brand-600 text-white' : 'bg-surface-700 text-slate-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'text-white' : 'text-slate-500'}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-8 h-px ${i < step ? 'bg-brand-600' : 'bg-surface-600'}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Create Team */}
        {step === 0 && (
          <form onSubmit={createTeam} className="card space-y-4">
            <h2 className="text-xl font-bold text-white">Create Your Team</h2>
            <p className="text-slate-400 text-sm">Teams group your projects and members together.</p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Team Name</label>
              <input className="input" placeholder="Acme Engineering" value={teamData.name}
                onChange={e => setTeamData(d => ({ ...d, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Invite Members (optional)</label>
              <input className="input" placeholder="alice@co.com, bob@co.com"
                value={teamData.members} onChange={e => setTeamData(d => ({ ...d, members: e.target.value }))} />
              <p className="text-xs text-slate-500 mt-1">Comma-separated emails of existing users</p>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Team →'}
            </button>
          </form>
        )}

        {/* Step 1: Create Project */}
        {step === 1 && (
          <form onSubmit={createProject} className="card space-y-4">
            <h2 className="text-xl font-bold text-white">Create Your Project</h2>
            <p className="text-slate-400 text-sm">A project represents one application or service you want to monitor.</p>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Project Name</label>
              <input className="input" placeholder="My API Service" value={projectData.name}
                onChange={e => setProjectData(d => ({ ...d, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Base URL</label>
              <input className="input" placeholder="https://api.myapp.com" value={projectData.baseUrl}
                onChange={e => setProjectData(d => ({ ...d, baseUrl: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Description (optional)</label>
              <input className="input" placeholder="Production API server" value={projectData.description}
                onChange={e => setProjectData(d => ({ ...d, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Alert Email</label>
              <input type="email" className="input" placeholder="alerts@myapp.com" value={projectData.alertEmail}
                onChange={e => setProjectData(d => ({ ...d, alertEmail: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project →'}
            </button>
          </form>
        )}

        {/* Step 2: Integration */}
        {step === 2 && createdProject && (
          <div className="card space-y-5">
            <h2 className="text-xl font-bold text-white">🎉 You're all set!</h2>
            <p className="text-slate-400 text-sm">Your credentials are ready. Add the agent to your app:</p>

            <div className="bg-surface-700 rounded-lg p-4 space-y-2">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">API Key</span>
                <code className="block text-brand-400 font-mono text-sm mt-1 break-all">{createdProject.apiKey}</code>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wide">Project ID</span>
                <code className="block text-brand-400 font-mono text-sm mt-1">{createdProject.projectId}</code>
              </div>
            </div>

            <div className="bg-surface-700 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-2">Install & initialize:</p>
              <pre className="text-xs text-green-400 font-mono overflow-x-auto">{`npm install @autoqual/agent

// In your app entry point:
const { AutoQualAgent } = require('@autoqual/agent');
AutoQualAgent.init({
  apiKey: '${createdProject.apiKey}',
  projectId: '${createdProject.projectId}',
  baseUrl: '${createdProject.baseUrl}'
});`}</pre>
            </div>

            <button onClick={() => navigate(`/dashboard/${createdProject.projectId}`)} className="btn-primary w-full">
              Open Dashboard →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
