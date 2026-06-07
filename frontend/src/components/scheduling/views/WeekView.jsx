/**
 * components/scheduling/views/WeekView.jsx
 *
 * 7-column CSS Grid time grid with virtualized rendering.
 * Shows 24 hours × 7 days. Scrollable, with sticky headers.
 */
import { useRef, useMemo } from 'react';
import { format, isToday, addDays, startOfWeek } from 'date-fns';
import { timeToTopPercent, durationToHeightPercent, HOURS, getWeekDays } from '../../../utils/calendarHelpers';
import CurrentTimeIndicator from '../CurrentTimeIndicator';
import EventBlock from '../EventBlock';
import useSchedulingStore from '../../../store/schedulingStore';
import useDragDrop from '../../../hooks/scheduling/useDragDrop';

const HOUR_HEIGHT_PX = 64; // px per hour
const TOTAL_HEIGHT   = HOUR_HEIGHT_PX * 24;

const WeekView = ({ events, onEventClick, onSlotClick, workWeek = false }) => {
  const { selectedDate } = useSchedulingStore();
  const gridRef = useRef(null);
  const { onPointerDown, onPointerDownResize, isDragging, dragEventId } = useDragDrop(gridRef);

  const days = useMemo(() =>
    workWeek ? Array.from({ length: 5 }, (_, i) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), i))
             : getWeekDays(selectedDate),
    [selectedDate, workWeek]
  );

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = {};
    days.forEach(d => { map[format(d, 'yyyy-MM-dd')] = []; });
    events.forEach(e => {
      const key = format(new Date(e.scheduled_time), 'yyyy-MM-dd');
      if (map[key]) map[key].push(e);
    });
    return map;
  }, [events, days]);

  const handleSlotClick = (day, hour) => {
    const time = new Date(day);
    time.setHours(hour, 0, 0, 0);
    onSlotClick?.({ date: time.toISOString(), day: format(day, 'yyyy-MM-dd') });
  };

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Day headers — sticky */}
      <div className="flex border-b border-borderSoft bg-slate-50/80 sticky top-0 z-10">
        {/* Gutter */}
        <div className="w-16 flex-shrink-0" />
        {days.map(day => (
          <div
            key={day.toISOString()}
            className={`flex-1 text-center py-3 border-l border-borderSoft ${
              isToday(day) ? 'bg-primary-50' : ''
            }`}
          >
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {format(day, 'EEE')}
            </div>
            <div className={`text-lg font-bold mt-0.5 w-8 h-8 mx-auto rounded-full flex items-center justify-center ${
              isToday(day)
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-800'
            }`}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable grid body */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" ref={gridRef} style={{ height: TOTAL_HEIGHT }}>
          {/* Time gutter */}
          <div className="w-16 flex-shrink-0 relative border-r border-borderSoft bg-surface">
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-start justify-end pr-2"
                style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
              >
                {h !== 0 && (
                  <span className="text-[10px] font-medium text-slate-500 -mt-2 select-none">
                    {format(new Date(2000, 0, 1, h), 'h a')}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map(day => {
            const key      = format(day, 'yyyy-MM-dd');
            const dayEvts  = eventsByDay[key] || [];
            const today    = isToday(day);

            return (
              <div
                key={key}
                className={`flex-1 relative border-l border-borderSoft ${today ? 'bg-primary-50/50' : ''}`}
                style={{ height: TOTAL_HEIGHT }}
              >
                {/* Hour grid lines */}
                {HOURS.map(h => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-borderSoft cursor-pointer hover:bg-primary-50 transition-colors"
                    style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                    onClick={() => handleSlotClick(day, h)}
                  />
                ))}

                {/* Half-hour lines */}
                {HOURS.map(h => (
                  <div
                    key={`half-${h}`}
                    className="absolute left-0 right-0 border-t border-slate-100"
                    style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }}
                  />
                ))}

                {/* Current time indicator */}
                {today && <CurrentTimeIndicator />}

                {/* Events */}
                {dayEvts.map(event => {
                  const topPct    = timeToTopPercent(event.scheduled_time, 24);
                  const heightPct = durationToHeightPercent(event.duration_minutes || 60, 24);

                  return (
                    <EventBlock
                      key={event.id || event._id}
                      event={event}
                      style={{
                        top:    `${topPct}%`,
                        height: `${heightPct}%`,
                        minHeight: '20px',
                      }}
                      onClick={onEventClick}
                      onDragStart={onPointerDown}
                      onDragResize={onPointerDownResize}
                      isDragging={isDragging && dragEventId === (event.id || event._id)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
