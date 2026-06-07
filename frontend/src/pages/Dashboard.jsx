import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardApi, teamsApi, interviewApi } from '../services/api';
import { format } from 'date-fns';
import { Calendar, Video, FileText, Clock, Plus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AssetCard } from '../components/dashboard/AssetCard';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

const Dashboard = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    scheduled_time: '',
    duration_minutes: 60,
    organizer_email: 'alex.recruiter@kadellabs.com',
    interviewer_email: 'alex.recruiter@kadellabs.com'
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
        organizer_email: formData.organizer_email,
        interviewer_email: formData.interviewer_email
      });
      setIsModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      alert(`Interview creation failed: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleScheduleTeams = async (interviewId) => {
    setScheduling(true);
    try {
      await teamsApi.schedule(interviewId);
      await fetchDashboard();
    } catch (err) {
      alert(`Scheduling failed: ${err?.response?.data?.message || err?.message}`);
    } finally {
      setScheduling(false);
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
            <button className="btn-primary flex items-center shadow-lg shadow-primary-500/20" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Schedule Interview
            </button>
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
                          <button 
                            onClick={() => handleScheduleTeams(interview._id || interview.id)}
                            disabled={scheduling}
                            className="btn-primary"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            {scheduling ? 'Scheduling...' : 'Schedule via Teams'}
                          </button>
                        ) : (
                          <a href={interview.meeting_join_url} target="_blank" rel="noreferrer" className="btn-secondary text-[#5B5FC7] hover:text-[#4a4ea8] hover:bg-[#5B5FC7]/10 border-[#5B5FC7]/20 flex items-center gap-2">
                            <Video className="w-4 h-4" /> Join Meeting
                          </a>
                        )}
                      </div>

                      {/* Assets Section */}
                      {hasTeams && <AssetCard interviewId={interview._id || interview.id} />}
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
                <input required type="number" step="15" className="input-field" value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: e.target.value})} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Organizer Email</label>
                <input required type="email" className="input-field" value={formData.organizer_email} onChange={e => setFormData({...formData, organizer_email: e.target.value})} />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Interviewer Email</label>
                <input required type="email" className="input-field" value={formData.interviewer_email} onChange={e => setFormData({...formData, interviewer_email: e.target.value})} />
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
