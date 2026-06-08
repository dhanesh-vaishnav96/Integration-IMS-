/**
 * components/scheduling/EventDetailDrawer.jsx
 *
 * Slide-out panel showing full interview details, attendee responses, 
 * Teams link, and action buttons (Reschedule/Cancel/Edit).
 */
import { useEffect, useState } from 'react';
import useSchedulingStore from '../../store/schedulingStore';
import schedulingApi from '../../services/schedulingApi';
import { X, Calendar as CalIcon, Clock, Users, Video, Edit2, Trash2, Copy, ExternalLink, MessageSquare, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { STATUS_COLORS } from '../../utils/calendarHelpers';

const EventDetailDrawer = () => {
  const { drawerOpen, closeDrawer, getSelectedEvent, openModal, removeEvent } = useSchedulingStore();
  const event = getSelectedEvent();
  const [copied, setCopied] = useState(false);

  // Close drawer on escape key
  useEffect(() => {
    const onEsc = (e) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [closeDrawer]);

  if (!drawerOpen || !event) return null;

  const statusColors = STATUS_COLORS[event.status] || STATUS_COLORS.SCHEDULED;
  const startTime = new Date(event.scheduled_time);
  const endTime = new Date(startTime.getTime() + (event.duration_minutes || 60) * 60000);

  const handleCopyLink = () => {
    if (event.meeting_join_url) {
      navigator.clipboard.writeText(event.meeting_join_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleEdit = () => {
    openModal('edit', event);
    closeDrawer();
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to cancel this interview? This will notify all participants.')) {
      try {
        await schedulingApi.deleteInterview(event.id || event._id);
        removeEvent(event.id || event._id);
        closeDrawer();
      } catch (err) {
        alert(err.response?.data?.message || err.message);
      }
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm transition-opacity"
        onClick={closeDrawer}
      />
      
      {/* Drawer */}
      <div className={`
        fixed top-0 right-0 bottom-0 z-50 w-[420px] bg-surface border-l border-borderSoft shadow-[0_0_40px_rgba(0,0,0,0.1)] 
        flex flex-col transform transition-transform duration-300
        ${drawerOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        
        {/* Header Ribbon */}
        <div className={`h-2 w-full ${statusColors.dot}`} />
        
        <div className="flex items-start justify-between p-7 pb-5">
          <div>
            <h2 className="text-[22px] font-bold text-slate-800 pr-4 tracking-tight">
              {event.is_private ? '🔒 Private Interview' : (event.title || 'Interview')}
            </h2>
            <div className="flex items-center gap-2 mt-3">
              <span className={`px-2.5 py-1 rounded-[6px] text-[11px] font-bold border uppercase tracking-wider ${statusColors.bg} ${statusColors.text}`}>
                {event.status}
              </span>
              {event.priority === 'URGENT' && (
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-[6px] border border-rose-200">
                  <AlertCircle className="w-3.5 h-3.5" /> URGENT
                </span>
              )}
            </div>
          </div>
          <button onClick={closeDrawer} className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-7 space-y-8 custom-scrollbar">
          
          {/* Time & Date */}
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-[12px] bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-700 flex-shrink-0 shadow-sm">
              <CalIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold text-slate-800">{format(startTime, 'EEEE, MMMM d, yyyy')}</p>
              <p className="text-[14px] font-medium text-slate-500 flex items-center gap-1.5 mt-1">
                <Clock className="w-4 h-4" />
                {format(startTime, 'h:mm a')} – {format(endTime, 'h:mm a')} 
                <span className="text-[12px] font-semibold text-slate-400 ml-1.5">({event.timezone_name})</span>
              </p>
            </div>
          </div>

          {/* Teams Link */}
          {event.meeting_provider === 'TEAMS' && (
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-[12px] bg-[#5B5FC7]/10 border border-[#5B5FC7]/20 flex items-center justify-center text-[#5B5FC7] flex-shrink-0 shadow-sm">
                <Video className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold text-slate-800">Microsoft Teams Meeting</p>
                {event.meeting_join_url ? (
                  <div className="flex flex-wrap items-center gap-4 mt-1.5">
                    <button 
                      onClick={() => window.open(event.meeting_join_url, '_blank')} 
                      className="btn-primary shadow-md flex justify-center items-center py-2 px-5 font-bold tracking-wider uppercase bg-[#5B5FC7] hover:bg-[#4a4ea8] text-xs text-white rounded-md"
                    >
                      <Video className="w-4 h-4 mr-2" /> JOIN MEETING
                    </button>
                    <button 
                      onClick={handleCopyLink}
                      className="text-[13px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1.5 transition"
                    >
                      {copied ? <span className="text-emerald-600 font-semibold">Copied!</span> : <><Copy className="w-3.5 h-3.5" /> Copy Link</>}
                    </button>
                  </div>
                ) : (
                  <p className="text-[13px] font-semibold text-amber-600 mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> Link generation pending...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Attendees */}
          <div className="space-y-3 pt-2">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4" /> Attendees
            </h3>
            
            <div className="bg-white border border-borderSoft shadow-sm rounded-[16px] divide-y divide-borderSoft overflow-hidden">
              {/* Candidate */}
              {event.candidate && (
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm border border-primary-200">
                      {event.candidate.name?.[0]?.toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-[14px] font-semibold text-slate-800 truncate">{event.candidate.name} <span className="text-[12px] font-medium text-primary-600 ml-1.5 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">Candidate</span></p>
                      <p className="text-[13px] font-medium text-slate-500 truncate mt-0.5">{event.candidate.email}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Other Participants */}
              {(event.participants || []).map(p => {
                const responseColor = 
                  p.response_status === 'ACCEPTED' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                  p.response_status === 'DECLINED' ? 'text-rose-600 bg-rose-50 border-rose-200' :
                  p.response_status === 'TENTATIVE' ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-100 border-slate-200';
                  
                return (
                  <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm flex-shrink-0 border border-slate-200 shadow-sm">
                        {(p.name || p.email)?.[0]?.toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="text-[14px] font-semibold text-slate-800 truncate">{p.name || p.email.split('@')[0]} <span className="text-[12px] font-medium text-slate-500 ml-1.5 capitalize bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{p.role.toLowerCase()}</span></p>
                        <p className="text-[13px] font-medium text-slate-500 truncate mt-0.5">{p.email}</p>
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-[6px] text-[10px] font-bold uppercase border tracking-wider flex-shrink-0 ${responseColor}`}>
                      {p.response_status.replace('_', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          {event.instructions && (
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Notes & Instructions
              </h3>
              <div className="bg-slate-50 border border-borderSoft shadow-sm rounded-[16px] p-5">
                <p className="text-[14px] font-medium text-slate-700 whitespace-pre-wrap leading-relaxed">{event.instructions}</p>
              </div>
            </div>
          )}
          
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-borderSoft bg-slate-50 flex items-center gap-4">
          <button onClick={handleDelete} className="btn-secondary text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 hover:border-rose-300">
            <Trash2 className="w-4 h-4" /> Cancel
          </button>
          <button onClick={handleEdit} className="btn-primary flex-1">
            <Edit2 className="w-4 h-4" /> Edit Interview
          </button>
        </div>

      </div>
    </>
  );
};

export default EventDetailDrawer;
