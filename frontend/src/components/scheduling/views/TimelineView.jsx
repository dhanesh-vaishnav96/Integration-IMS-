/**
 * components/scheduling/views/TimelineView.jsx
 *
 * Horizontal timeline — rows = panelists, columns = time slots.
 * Shows panelist availability and interview blocks side-by-side.
 */
import { useMemo } from 'react';
import { format } from 'date-fns';
import useSchedulingStore from '../../../store/schedulingStore';
import { STATUS_COLORS } from '../../../utils/calendarHelpers';

const CELL_WIDTH_PX = 80; // px per hour
const ROW_HEIGHT    = 56;

const TimelineView = ({ events, onEventClick }) => {
  const { selectedDate } = useSchedulingStore();

  const days = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i)),
    [selectedDate]
  );

  // Collect unique panelists across all events
  const panelists = useMemo(() => {
    const set = new Map();
    events.forEach(e => {
      if (e.organizer_email) set.set(e.organizer_email, { email: e.organizer_email, name: e.organizer_email.split('@')[0] });
      (e.participants || []).forEach(p => set.set(p.email, { email: p.email, name: p.name || p.email.split('@')[0] }));
    });
    return Array.from(set.values());
  }, [events]);

  // Total hours = 7 days × 24
  const totalHours = 7 * 24;
  const totalWidth = totalHours * CELL_WIDTH_PX;
  const weekStart  = startOfWeek(selectedDate, { weekStartsOn: 1 });

  const eventToTimelinePos = (event) => {
    const start      = new Date(event.scheduled_time);
    const msSinceWeek = start - weekStart;
    const hoursSince  = msSinceWeek / (1000 * 3600);
    const left        = hoursSince * CELL_WIDTH_PX;
    const width       = ((event.duration_minutes || 60) / 60) * CELL_WIDTH_PX;
    return { left, width };
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ minWidth: totalWidth + 160 }}>
          {/* Left column: panelist names */}
          <div className="w-40 flex-shrink-0 sticky left-0 z-10 bg-dark-900 border-r border-dark-700/50">
            {/* Header */}
            <div className="h-10 border-b border-dark-700/50 flex items-center px-3 text-xs text-slate-500 font-medium">
              PANELIST
            </div>
            {panelists.map(p => (
              <div key={p.email} className="h-14 border-b border-dark-700/20 flex items-center px-3 gap-2">
                <div className="w-7 h-7 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium text-slate-300">
                  {p.name[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-slate-300 truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.email.split('@')[1]}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline grid */}
          <div className="relative" style={{ width: totalWidth }}>
            {/* Day + hour headers */}
            <div className="h-10 flex border-b border-dark-700/50 sticky top-0 z-10 bg-dark-800">
              {days.map(day => (
                <div key={day.toISOString()} className="border-r border-dark-700/30"
                     style={{ width: 24 * CELL_WIDTH_PX }}>
                  <div className="px-2 py-1 text-xs font-medium text-slate-400">
                    {format(day, 'EEE d')}
                  </div>
                </div>
              ))}
            </div>

            {/* Panelist rows */}
            {panelists.map((panelist) => {
              const pEvents = events.filter(e =>
                e.organizer_email === panelist.email ||
                (e.participants || []).some(p => p.email === panelist.email)
              );

              return (
                <div key={panelist.email} className="relative border-b border-dark-700/20"
                     style={{ height: ROW_HEIGHT, width: totalWidth }}>
                  {/* Hour grid lines */}
                  {Array.from({ length: totalHours }, (_, h) => (
                    <div key={h} className="absolute top-0 bottom-0 border-l border-dark-700/10"
                         style={{ left: h * CELL_WIDTH_PX }} />
                  ))}

                  {/* Events */}
                  {pEvents.map(event => {
                    const { left, width } = eventToTimelinePos(event);
                  const status = event.status || 'SCHEDULED';
                  const colors = STATUS_COLORS[status] || STATUS_COLORS.SCHEDULED;

                    return (
                      <div
                        key={event.id || event._id}
                        className={`absolute top-2 bottom-2 rounded-lg border-l-2 px-2 flex items-center cursor-pointer
                          ${colors.bg} ${colors.text.replace('text-', 'border-')} hover:brightness-125`}
                        style={{ left, width: Math.max(width, 20) }}
                        onClick={() => onEventClick?.(event)}
                        title={event.title || event.type}
                      >
                        <span className={`text-xs truncate ${colors.text}`}>
                          {event.candidate?.name || event.type}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {panelists.length === 0 && (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                No panelists found for this week's interviews.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimelineView;
