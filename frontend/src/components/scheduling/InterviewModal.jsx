/**
 * components/scheduling/InterviewModal.jsx
 *
 * Simplified 2-step scheduling modal.
 * Validates conflicts before save via ConflictService.
 */
import { useState, useEffect } from 'react';
import useSchedulingStore from '../../store/schedulingStore';
import schedulingApi from '../../services/schedulingApi';
import { X, AlertCircle, Plus, Trash2, Users, Video, Calendar, Clock, User, AlignLeft } from 'lucide-react';
import { format, addHours } from 'date-fns';

const InterviewModal = () => {
  const { modalState, closeModal, addEvent, updateEvent } = useSchedulingStore();
  const [step, setStep] = useState(1);
  
  const [formData, setFormData] = useState({
    title: '',
    candidate_id: '',
    date: format(new Date(), "yyyy-MM-dd"),
    time: format(new Date(), "HH:00"),
    duration_minutes: 60,
    instructions: '',
    participants: [], // { email, role, is_required }
  });
  
  const [candidates, setCandidates] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newParticipantEmail, setNewParticipantEmail] = useState('');

  useEffect(() => {
    if (modalState.open) {
      setStep(1); // Reset to step 1
      // Load candidates
      schedulingApi.getCandidates().then(res => {
        const candidatesData = res.data?.data?.data || res.data?.data || [];
        setCandidates(Array.isArray(candidatesData) ? candidatesData : []);
      });
      
      if (modalState.mode === 'edit' && modalState.initialData) {
        const d = modalState.initialData;
        const dDate = new Date(d.scheduled_time);
        setFormData({
          title: d.title || '',
          candidate_id: d.candidate_id || '',
          date: format(dDate, "yyyy-MM-dd"),
          time: format(dDate, "HH:mm"),
          duration_minutes: d.duration_minutes || 60,
          instructions: d.instructions || '',
          participants: d.participants || [],
        });
      } else {
        // Create mode defaults
        const initialDate = modalState.initialData?.date ? new Date(modalState.initialData.date) : new Date();
        setFormData(prev => ({
          ...prev,
          date: format(initialDate, "yyyy-MM-dd"),
          time: format(initialDate, "HH:00"),
          title: '',
          candidate_id: '',
          duration_minutes: 60,
          instructions: '',
          participants: [],
        }));
      }
    }
  }, [modalState]);

  const getScheduledTimeISO = () => {
    if (!formData.date || !formData.time) return null;
    try {
      return new Date(`${formData.date}T${formData.time}`).toISOString();
    } catch (e) {
      return null;
    }
  };

  // Conflict Check
  useEffect(() => {
    const check = async () => {
      const scheduledISO = getScheduledTimeISO();
      if (!scheduledISO || modalState.mode === 'edit') return;
      try {
        const res = await schedulingApi.checkConflicts('new', {
          candidateId: formData.candidate_id,
          participants: formData.participants.map(p => p.email).join(','),
          startTime: scheduledISO,
          endTime: addHours(new Date(scheduledISO), formData.duration_minutes / 60).toISOString(),
          travelBufferMinutes: 0,
        });
        setConflicts(res.data.data?.conflicts || []);
      } catch (err) {
        console.error("Conflict check failed", err);
      }
    };
    const t = setTimeout(check, 500);
    return () => clearTimeout(t);
  }, [formData.date, formData.time, formData.duration_minutes, formData.candidate_id, formData.participants, modalState.mode]);

  if (!modalState.open) return null;

  const handleNext = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = async () => {
    if (conflicts.some(c => c.severity === 'ERROR')) {
      alert("Please resolve blocking conflicts before saving.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const scheduledISO = getScheduledTimeISO();
      
      const payload = {
        title: formData.title,
        candidate_id: formData.candidate_id,
        scheduled_time: scheduledISO,
        duration_minutes: formData.duration_minutes,
        instructions: formData.instructions,
        participants: formData.participants,
        // Hardcoded simplifications
        type: 'TECHNICAL',
        priority: 'MEDIUM',
        meeting_provider: 'TEAMS',
        meeting_color: '#0E2D7B',
        is_private: false,
        travel_buffer_minutes: 0,
        recurrence_rule: null,
      };
      
      if (modalState.mode === 'edit') {
        const { data } = await schedulingApi.updateInterview(modalState.initialData.id || modalState.initialData._id, payload);
        updateEvent(data.data);
      } else {
        const { data } = await schedulingApi.createInterview(payload);
        addEvent(data.data.interview);
      }
      closeModal();
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const addParticipant = () => {
    if (!newParticipantEmail) return;
    const cleanEmail = newParticipantEmail.trim().toLowerCase();
    
    // Check duplicates
    if (formData.participants.some(p => p.email === cleanEmail)) {
      alert("This participant is already added.");
      return;
    }
    
    if (formData.participants.length >= 20) {
      alert("Maximum of 20 panelists allowed.");
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      participants: [...prev.participants, { email: cleanEmail, role: 'PANELIST', is_required: true }]
    }));
    setNewParticipantEmail('');
  };

  const removeParticipant = (idx) => {
    setFormData(prev => ({
      ...prev,
      participants: prev.participants.filter((_, i) => i !== idx)
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-surface border border-borderSoft rounded-[20px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-borderSoft bg-slate-50/50 rounded-t-[20px]">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              {modalState.mode === 'edit' ? 'Edit Interview' : 'Schedule Interview'}
            </h2>
            <p className="text-[13px] font-medium text-slate-500 mt-1 uppercase tracking-wider">
              Step {step} of 2 {step === 1 ? '- Details' : '- Review'}
            </p>
          </div>
          <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className={`p-4 rounded-[12px] border ${conflicts.some(c => c.severity === 'ERROR') ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'}`}>
              <h4 className={`font-semibold text-[15px] flex items-center gap-2 ${conflicts.some(c => c.severity === 'ERROR') ? 'text-rose-700' : 'text-amber-700'}`}>
                <AlertCircle className="w-4 h-4" /> 
                Scheduling Conflicts Detected
              </h4>
              <ul className="mt-2 space-y-1 text-[13px] text-slate-700 list-disc list-inside">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.message}</li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <form id="interview-form" onSubmit={handleNext} className="space-y-6">
              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Interview Title</label>
                <input 
                  type="text" required
                  className="input-field"
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                  placeholder="e.g. Frontend Technical Round 1"
                />
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Candidate</label>
                <select 
                  required
                  className="input-field"
                  value={formData.candidate_id} onChange={e => setFormData({...formData, candidate_id: e.target.value})}
                >
                  <option value="">Select Candidate...</option>
                  {candidates.map(c => <option key={c.id || c._id} value={c.id || c._id}>{c.name} ({c.job_role})</option>)}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Date</label>
                  <input 
                    type="date" required min={format(new Date(), "yyyy-MM-dd")}
                    className="input-field"
                    value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Time</label>
                  <input 
                    type="time" required
                    className="input-field"
                    value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Duration (min)</label>
                  <input 
                    type="number" min="15" max="240" step="1" required
                    className="input-field"
                    value={formData.duration_minutes} onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              {/* Panelists */}
              <div className="bg-slate-50/50 p-4 rounded-[16px] border border-borderSoft">
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Panelists</label>
                <div className="flex gap-2 mb-3">
                  <input 
                    type="email" 
                    placeholder="Add panelist email..." 
                    className="input-field flex-1"
                    value={newParticipantEmail} onChange={e => setNewParticipantEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
                  />
                  <button type="button" onClick={addParticipant} className="btn-secondary px-4 py-2">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                  {formData.participants.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-white border border-borderSoft rounded-[12px] shadow-sm">
                      <Users className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-slate-700 truncate">{p.email}</p>
                      </div>
                      <select 
                        className="bg-slate-50 border border-borderSoft rounded-[8px] px-2 py-1 text-xs font-medium text-slate-600 outline-none"
                        value={p.role} onChange={e => {
                          const n = [...formData.participants];
                          n[idx].role = e.target.value;
                          setFormData({...formData, participants: n});
                        }}
                      >
                        <option value="PANELIST">Panelist</option>
                        <option value="OBSERVER">Observer</option>
                      </select>
                      <button type="button" onClick={() => removeParticipant(idx)} className="text-slate-400 hover:text-rose-500 p-1 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {formData.participants.length === 0 && (
                    <div className="text-[13px] text-slate-500 italic text-center py-5 bg-white rounded-[12px] border border-slate-200 border-dashed">
                      No panelists added. Candidate is included automatically.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Meeting Notes / Instructions</label>
                <textarea 
                  rows="3"
                  className="input-field custom-scrollbar py-3"
                  value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})}
                  placeholder="Notes for panelists..."
                />
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="bg-slate-50 border border-borderSoft rounded-[16px] p-6 space-y-5 shadow-sm">
                <div className="flex items-start gap-4 pb-5 border-b border-borderSoft">
                  <div className="p-3 bg-primary-100 rounded-[12px] border border-primary-200 shadow-sm">
                    <Video className="w-6 h-6 text-primary-800" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">{formData.title}</h3>
                    <p className="text-[13px] font-medium text-slate-500 mt-1">Microsoft Teams Meeting</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Date</p>
                      <p className="text-[14px] font-semibold text-slate-700">{formData.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Time & Duration</p>
                      <p className="text-[14px] font-semibold text-slate-700">{formData.time} ({formData.duration_minutes} min)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">Candidate</p>
                      <p className="text-[14px] font-semibold text-slate-700">
                        {candidates.find(c => (c.id || c._id) === formData.candidate_id)?.name || 'Selected Candidate'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Users className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Panelists</p>
                      {formData.participants.length > 0 ? (
                        <div className="space-y-1">
                          {formData.participants.map((p, i) => (
                            <p key={i} className="text-[13px] font-semibold text-slate-600">{p.email}</p>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[13px] font-semibold text-slate-500">None</p>
                      )}
                    </div>
                  </div>
                </div>
                
                {formData.instructions && (
                  <div className="pt-5 border-t border-borderSoft flex items-start gap-3">
                    <AlignLeft className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-1">Notes</p>
                      <p className="text-[13px] text-slate-600 whitespace-pre-wrap">{formData.instructions}</p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <p className="text-[13px] text-slate-500 font-medium">Please review the details above. Click Confirm & Schedule to send invites.</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-borderSoft bg-slate-50/50 rounded-b-[20px]">
          {step === 1 ? (
            <>
              <button 
                type="button" onClick={closeModal}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button 
                type="submit" form="interview-form" disabled={conflicts.some(c => c.severity === 'ERROR')}
                className="btn-primary px-8"
              >
                Next Step
              </button>
            </>
          ) : (
            <>
              <button 
                type="button" onClick={() => setStep(1)}
                className="btn-secondary"
              >
                Back
              </button>
              <button 
                type="button" onClick={handleSubmit} disabled={isSubmitting || conflicts.some(c => c.severity === 'ERROR')}
                className="btn-primary px-8"
              >
                {isSubmitting ? 'Scheduling...' : 'Confirm & Schedule'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default InterviewModal;
