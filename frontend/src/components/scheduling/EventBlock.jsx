/**
 * components/scheduling/EventBlock.jsx
 *
 * Draggable, resizable event pill for Day/Week views.
 * Shows interview type color, title, candidate, time.
 */
import { useRef } from 'react';
import { format } from 'date-fns';
import { STATUS_COLORS } from '../../utils/calendarHelpers';
import { Video, User, AlertCircle, Clock } from 'lucide-react';

const EventBlock = ({ event, style, onClick, onDragStart, onDragResize, isDragging }) => {
  const status  = event.status || 'SCHEDULED';
  const colors  = STATUS_COLORS[status] || STATUS_COLORS.SCHEDULED;
  const resizeRef = useRef(null);

  const startTime = format(new Date(event.scheduled_time), 'h:mm a');
  const title     = event.title || 'Interview';
  const candidate = event.candidate?.name || event.organizer_email || '';
  const duration  = event.duration_minutes || 60;

  const isShort   = duration < 30;

  return (
    <div
      className={`
        absolute left-1 right-1 rounded-[8px] border-l-4 px-2.5 py-1.5 cursor-pointer
        select-none overflow-hidden group transition-all duration-150 shadow-sm
        ${colors.bg} ${colors.text.replace('text-', 'border-')}
        ${isDragging ? 'opacity-50 scale-95 shadow-xl ring-2 ring-primary-500/50' : 'hover:-translate-y-[1px] hover:shadow-md'}
        ${event.is_private ? 'opacity-80' : ''}
      `}
      style={style}
      onClick={(e) => { e.stopPropagation(); onClick?.(event); }}
      onPointerDown={(e) => onDragStart?.(e, event)}
      role="button"
      tabIndex={0}
      aria-label={`${title} at ${startTime}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.(event)}
    >
      {/* Priority indicator */}
      {event.priority === 'URGENT' && (
        <div className="absolute top-1 right-1">
          <AlertCircle className="w-3 h-3 text-rose-400" />
        </div>
      )}

      <div className={`flex flex-col gap-0.5`}>
        {/* Title */}
        <span className={`text-xs font-semibold leading-tight truncate ${colors.text}`}>
          {event.is_private ? '🔒 Private' : title}
        </span>

        {/* Status */}
        <span className={`text-[10px] font-bold uppercase tracking-wider ${colors.text}`}>
          {status}
        </span>

        {/* Time & Duration */}
        {!isShort && (
          <span className={`text-[10px] font-medium opacity-80 flex items-center gap-1 ${colors.text}`}>
            <Clock className="w-2.5 h-2.5 flex-shrink-0" />
            {startTime} ({duration}m)
          </span>
        )}

        {/* Candidate */}
        {!isShort && candidate && (
          <span className={`text-[10px] opacity-70 truncate flex items-center gap-1 ${colors.text}`}>
            <User className="w-2.5 h-2.5 flex-shrink-0" />
            {candidate}
          </span>
        )}

        {/* Teams link indicator */}
        {event.meeting_join_url && !isShort && (
          <span className={`text-[10px] opacity-60 flex items-center gap-1 ${colors.text}`}>
            <Video className="w-2.5 h-2.5 flex-shrink-0" />
            Teams
          </span>
        )}
      </div>

      {/* Resize handle */}
      <div
        ref={resizeRef}
        data-resize-handle="true"
        className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize opacity-0 group-hover:opacity-100 transition-opacity z-10"
        style={{ background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4))' }}
        onPointerDown={(e) => onDragResize?.(e, event)}
      />
    </div>
  );
};

export default EventBlock;
