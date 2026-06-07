/**
 * components/scheduling/views/DayView.jsx
 */
import { useRef } from 'react';
import { format, isSameDay, isToday } from 'date-fns';
import useSchedulingStore from '../../../store/schedulingStore';
import { HOURS, timeToTopPercent, durationToHeightPercent } from '../../../utils/calendarHelpers';
import CurrentTimeIndicator from '../CurrentTimeIndicator';
import EventBlock from '../EventBlock';
import useDragDrop from '../../../hooks/scheduling/useDragDrop';

const HOUR_HEIGHT_PX = 64;
const TOTAL_HEIGHT = HOUR_HEIGHT_PX * 24;

const DayView = ({ events, onEventClick, onSlotClick }) => {
  const { selectedDate } = useSchedulingStore();
  const dayEvents = events.filter(e => isSameDay(new Date(e.scheduled_time), selectedDate));
  
  const gridRef = useRef(null);
  const { onPointerDown, onPointerDownResize, isDragging, dragEventId } = useDragDrop(gridRef);
  const day = selectedDate;

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="flex border-b border-borderSoft bg-slate-50/80 sticky top-0 z-10">
        <div className="w-16 flex-shrink-0" />
        <div className={`flex-1 text-center py-3 ${isToday(day) ? 'bg-primary-50' : ''}`}>
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{format(day, 'EEEE')}</div>
          <div className={`text-2xl font-bold mt-0.5 w-10 h-10 mx-auto rounded-full flex items-center justify-center ${
            isToday(day) ? 'bg-primary-600 text-white' : 'text-slate-800'
          }`}>
            {format(day, 'd')}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="flex" ref={gridRef} style={{ height: TOTAL_HEIGHT }}>
          <div className="w-16 flex-shrink-0 relative border-r border-borderSoft bg-surface">
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 flex items-start justify-end pr-2"
                   style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}>
                {h !== 0 && <span className="text-[10px] font-medium text-slate-500 -mt-2 select-none">{format(new Date(2000,0,1,h), 'h a')}</span>}
              </div>
            ))}
          </div>
          <div className="flex-1 relative" style={{ height: TOTAL_HEIGHT }}>
            {HOURS.map(h => (
              <div key={h}
                   className="absolute left-0 right-0 border-t border-borderSoft cursor-pointer hover:bg-primary-50 transition-colors"
                   style={{ top: h * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                   onClick={() => { const t = new Date(day); t.setHours(h,0,0,0); onSlotClick?.({ date: t.toISOString() }); }}
              />
            ))}
            {HOURS.map(h => (
              <div key={`h-${h}`} className="absolute left-0 right-0 border-t border-slate-100"
                   style={{ top: h * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2 }} />
            ))}
            {isToday(day) && <CurrentTimeIndicator />}
            {dayEvents.map(event => (
              <EventBlock
                key={event.id || event._id}
                event={event}
                style={{ top: `${timeToTopPercent(event.scheduled_time, 24)}%`, height: `${durationToHeightPercent(event.duration_minutes || 60, 24)}%`, minHeight: '20px' }}
                onClick={onEventClick}
                onDragStart={onPointerDown}
                onDragResize={onPointerDownResize}
                isDragging={isDragging && dragEventId === (event.id || event._id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
