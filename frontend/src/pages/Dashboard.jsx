import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { dashboardApi, teamsApi, interviewApi, candidateApi } from '../services/api';
import { format } from 'date-fns';
import { Calendar, Video, FileText, Clock, Plus, X, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AssetCard } from '../components/dashboard/AssetCard';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Dashboard = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_time: '',
    duration_minutes: 60,
    panelist_emails: ''
  });

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await dashboardApi.getDashboard(id);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleCreateInterview = async (e) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      await interviewApi.create({
        candidate_id: id,
        scheduled_time: new Date(formData.scheduled_time).toISOString(),
        duration_minutes: Number(formData.duration_minutes),
      });
      setIsModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      alert(`Interview creation failed: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleScheduleTeams = async (interviewId, panelists = []) => {
    setScheduling(true);
    try {
      await teamsApi.schedule(interviewId, panelists);
      await fetchDashboard();
    } catch (err) {
      alert(`Scheduling failed: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setScheduling(false);
    }
  };

  const handleDeleteCandidate = async () => {
    if (window.confirm("Are you sure you want to delete this candidate? This will cancel all scheduled interviews and cannot be undone.")) {
      try {
        await candidateApi.delete(id);
        navigate('/');
      } catch (err) {
        alert(`Deletion failed: ${err?.response?.data?.message || err?.message}`);
      }
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-medium">Loading candidate dashboard...</div>;
  if (!data) return <div className="p-8 text-center text-rose-500 font-medium">Failed to load dashboard.</div>;

  const candidate = data?.candidate || {};
  const interviews = data?.interviews || [];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Candidate Profile Header */}
      <div className="bg-surface border border-borderSoft rounded-[24px] shadow-sm p-8 relative overflow-hidden flex flex-col gap-6">
        <div className="absolute top-0 right-0 p-12 bg-primary-50 rounded-bl-full w-64 h-64 -mr-16 -mt-16 opacity-50 pointer-events-none"></div>
        
        <div className="flex justify-between items-start z-10">
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">{candidate.name}</h1>
            <div className="flex items-center space-x-6 text-slate-500 font-medium text-[15px]">
              <span className="flex items-center"><FileText className="w-4 h-4 mr-2 text-primary-500" /> {candidate.job_role}</span>
              <span className="flex items-center"><Clock className="w-4 h-4 mr-2 text-primary-500" /> {candidate.years_of_experience} yrs exp</span>
              <span>{candidate.email}</span>
            </div>
          </div>
          <div className="text-right flex flex-col items-end space-y-4">
            <div className="flex gap-3">
              <button className="btn-secondary flex items-center border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300" onClick={handleDeleteCandidate}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Candidate
              </button>
              <button className="btn-primary flex items-center shadow-lg shadow-primary-500/20" onClick={() => setIsModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> Schedule Interview
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Interviews & Artifacts */}
      <div className="flex gap-8 mt-8">
        <div className="flex-1">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-xl font-bold text-slate-800">Interviews & Artifacts</h2>
          </div>

          {interviews.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[24px] p-12 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-medium mb-6">No interviews scheduled yet.</p>
              <button className="btn-secondary" onClick={() => setIsModalOpen(true)}>Create Interview</button>
            </div>
          ) : (
            <div className="space-y-6">
              {interviews.map((interview, index) => {
                const hasTeams = !!interview.teams_meeting_id;
                return (
                  <div key={interview._id || interview.id} className="bg-surface border border-borderSoft rounded-[20px] overflow-hidden transition-all hover:shadow-md hover:border-slate-300">
                    <div className="p-7">
                      <div className="flex items-start justify-between mb-7">
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            Round {index + 1}: {interview.title || 'Technical Interview'}
                            <span className={cn('ml-3 px-2 py-0.5 rounded-[6px] text-[10px] font-bold uppercase tracking-wider border', 
                              interview.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                              interview.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              {interview.status}
                            </span>
                          </h3>
                          <div className="flex items-center text-slate-500 font-medium text-sm mt-2.5 space-x-6">
                            <span className="flex items-center">
                              <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                              {format(new Date(interview.scheduled_time), 'PPp')}
                            </span>
                            <span className="flex items-center">
                              <Clock className="w-4 h-4 mr-2 text-slate-400" />
                              {interview.duration_minutes} mins
                            </span>
                          </div>
                        </div>
                        
                        {!hasTeams ? (
                          <div className="flex flex-col items-end gap-2">
                            <button 
                              onClick={() => handleScheduleTeams(interview._id || interview.id, interview.participants?.map(p => p.email) || [])}
                              disabled={scheduling}
                              className="btn-primary"
                            >
                              <Video className="w-4 h-4 mr-2" />
                              {scheduling ? 'Scheduling...' : 'Schedule via Teams'}
                            </button>
                            <span className="text-[10px] text-slate-400 italic max-w-[200px] text-right">
                              Note: Automatic recording requires Teams meeting policy configuration.
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-2">
                            <button 
                              onClick={() => window.open(interview.meeting_join_url, '_blank')} 
                              className="btn-primary shadow-md flex justify-center items-center py-2.5 px-6 font-bold tracking-wider uppercase bg-[#5B5FC7] hover:bg-[#4a4ea8]"
                            >
                              JOIN MEETING
                            </button>
                            <span className="text-[10px] text-slate-400 italic max-w-[200px] text-right">
                              Automatic recording depends on your IT Teams Policy.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Assets Section */}
                      <AssetCard interviewId={interview._id || interview.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create Interview Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-borderSoft rounded-[24px] w-full max-w-md shadow-[0_0_40px_rgba(0,0,0,0.1)] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-borderSoft bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-800">Schedule Interview</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateInterview} className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Scheduled Date & Time</label>
                <input required type="datetime-local" className="input-field" value={formData.scheduled_time} onChange={e => setFormData({...formData, scheduled_time: e.target.value})} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Duration (minutes)</label>
                <input required type="number" min="10" step="5" className="input-field" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: e.target.value})} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Additional Panelist Emails (comma separated)</label>
                <input type="text" placeholder="e.g. Achyut.Pancholi@kadellabs.com" className="input-field" value={formData.panelist_emails || ''} onChange={e => setFormData({...formData, panelist_emails: e.target.value})} />
              </div>
              <div className="pt-4 flex justify-end gap-3 border-t border-borderSoft mt-4">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={isCreating}>
                  {isCreating ? 'Scheduling...' : 'Schedule Interview'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;
