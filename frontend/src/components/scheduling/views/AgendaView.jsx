/**
 * components/scheduling/views/AgendaView.jsx
 *
 * Scrollable chronological list of upcoming events.
 */
import { useMemo } from 'react';
import { format, isToday } from 'date-fns';
import { STATUS_COLORS } from '../../../utils/calendarHelpers';
import { Video, User, Clock, Calendar, AlertCircle, ChevronRight } from 'lucide-react';

const AgendaView = ({ events, onEventClick }) => {

  // Group events by date string
  const grouped = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = format(new Date(e.scheduled_time), 'yyyy-MM-dd');
      if (!map[key]) map[key] = { date: new Date(e.scheduled_time), events: [] };
      map[key].events.push(e);
    });
    return Object.values(map).sort((a, b) => a.date - b.date);
  }, [events]);

  if (grouped.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <Calendar className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">No interviews scheduled in this period</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
      {grouped.map(({ date, events: dayEvts }) => {
        const today = isToday(date);
        return (
          <div key={date.toISOString()}>
            {/* Date header */}
            <div className={`flex items-center gap-3 mb-3 sticky top-0 py-2 ${today ? 'text-primary-400' : 'text-slate-400'}`}
                 style={{ background: 'var(--bg-dark-900, #020617)' }}>
              <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center text-center border ${
                today ? 'bg-primary-500 border-primary-400 text-white' : 'border-dark-600 text-slate-300'
              }`}>
                <span className="text-[10px] uppercase leading-none">{format(date, 'MMM')}</span>
                <span className="text-sm font-bold leading-none">{format(date, 'd')}</span>
              </div>
              <div>
                <div className={`text-sm font-semibold ${today ? 'text-primary-400' : 'text-slate-300'}`}>
                  {today ? 'Today' : format(date, 'EEEE')}
                </div>
                <div className="text-xs text-slate-500">{format(date, 'MMMM d, yyyy')}</div>
              </div>
              <div className="ml-auto text-xs text-slate-600">{dayEvts.length} interview{dayEvts.length !== 1 ? 's' : ''}</div>
            </div>

            {/* Events for this day */}
            <div className="space-y-2 ml-13">
              {dayEvts.map(event => {
                const status = event.status || 'SCHEDULED';
                const colors = STATUS_COLORS[status] || STATUS_COLORS.SCHEDULED;
                const startFmt = format(new Date(event.scheduled_time), 'h:mm a');
                const endTime  = new Date(new Date(event.scheduled_time).getTime() + (event.duration_minutes || 60) * 60000);
                const endFmt   = format(endTime, 'h:mm a');

                return (
                  <div
                    key={event.id || event._id}
                    onClick={() => onEventClick?.(event)}
                    className={`
                      ml-13 flex items-start gap-3 p-3 rounded-xl border cursor-pointer
                      ${colors.bg} border-dark-700/50 hover:border-dark-600
                      hover:brightness-110 transition-all group
                    `}
                  >
                    {/* Type color bar */}
                    <div className={`w-1 self-stretch rounded-full ${colors.dot}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className={`text-sm font-semibold ${colors.text} truncate`}>
                            {event.is_private ? '🔒 Private Interview' : (event.title || `${event.type} Interview`)}
                          </h4>
                          {event.candidate?.name && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" /> {event.candidate.name}
                            </p>
                          )}
                        </div>
                        {event.priority === 'URGENT' && (
                          <span className="flex-shrink-0 flex items-center gap-1 text-rose-400 text-xs">
                            <AlertCircle className="w-3 h-3" /> URGENT
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {startFmt} – {endFmt} ({event.duration_minutes || 60}m)
                        </span>
                        {event.meeting_join_url && (
                          <button
                            onClick={(e) => { e.stopPropagation(); window.open(event.meeting_join_url, '_blank'); }}
                            className="btn-primary shadow-md flex justify-center items-center py-1.5 px-3 font-bold tracking-wider uppercase bg-[#5B5FC7] hover:bg-[#4a4ea8] text-[10px] text-white rounded"
                          >
                            <Video className="w-3 h-3 mr-1" /> JOIN MEETING
                          </button>
                        )}
                        {event.round && (
                          <span className="text-xs text-slate-500">Round {event.round}</span>
                        )}
                      </div>

                      {event.participants?.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          {event.participants.slice(0, 3).map(p => (
                            <div key={p.id} className="w-6 h-6 rounded-full bg-dark-600 border border-dark-500 flex items-center justify-center text-[9px] text-slate-300 font-medium" title={p.email}>
                              {(p.name || p.email)?.[0]?.toUpperCase()}
                            </div>
                          ))}
                          {event.participants.length > 3 && (
                            <span className="text-xs text-slate-500">+{event.participants.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 flex-shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaView;
