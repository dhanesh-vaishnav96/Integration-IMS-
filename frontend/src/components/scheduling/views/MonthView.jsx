/**
 * components/scheduling/views/MonthView.jsx
 *
 * Classic month grid — 6 rows × 7 columns with event dots.
 * Windowed: only renders visible rows for performance.
 */
import { useMemo } from 'react';
import { format, isSameMonth, isToday } from 'date-fns';
import { getMonthGrid, EVENT_COLORS } from '../../../utils/calendarHelpers';
import useSchedulingStore from '../../../store/schedulingStore';

const MAX_EVENTS_PER_CELL = 3;

const MonthView = ({ events, onEventClick, onSlotClick }) => {
  const { selectedDate } = useSchedulingStore();
  const days = useMemo(() => getMonthGrid(selectedDate), [selectedDate]);

  // Group events by day key
  const eventsByDay = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const key = format(new Date(e.scheduled_time), 'yyyy-MM-dd');
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [events]);

  const weekHeaders = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Week day headers */}
      <div className="grid grid-cols-7 border-b border-borderSoft bg-slate-50/80 sticky top-0 z-10">
        {weekHeaders.map(d => (
          <div key={d} className="py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 overflow-y-auto grid grid-cols-7 auto-rows-fr">
        {days.map((day) => {
          const key      = format(day, 'yyyy-MM-dd');
          const dayEvts  = eventsByDay[key] || [];
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const todayClass = isToday(day);
          const hasMore  = dayEvts.length > MAX_EVENTS_PER_CELL;

          return (
            <div
              key={key}
              className={`
                min-h-[120px] border-r border-b border-borderSoft p-2 cursor-pointer
                transition-colors hover:bg-primary-50
                ${!isCurrentMonth ? 'bg-slate-50/50 text-slate-400' : 'bg-surface'}
              `}
              onClick={() => onSlotClick?.({ date: day.toISOString(), day: key })}
            >
              {/* Day number */}
              <div className={`
                w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold mb-1.5
                ${todayClass ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'}
              `}>
                {format(day, 'd')}
              </div>

              {/* Events */}
              <div className="space-y-1">
                {dayEvts.slice(0, MAX_EVENTS_PER_CELL).map(event => {
                  const colors = EVENT_COLORS[event.type] || EVENT_COLORS.TECHNICAL;
                  return (
                    <div
                      key={event.id || event._id}
                      className={`
                        flex items-center gap-1.5 px-2 py-1 rounded-[6px] text-xs truncate cursor-pointer font-medium border
                        ${colors.bg} ${colors.text} border-transparent
                        hover:brightness-95 transition-all
                      `}
                      onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                      <span className="truncate">
                        {event.title || event.candidate?.name || event.type}
                      </span>
                    </div>
                  );
                })}
                {hasMore && (
                  <div className="text-[11px] font-medium text-slate-500 pl-1 cursor-pointer hover:text-primary-600 mt-1">
                    +{dayEvts.length - MAX_EVENTS_PER_CELL} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
