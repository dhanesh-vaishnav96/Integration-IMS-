/**
 * components/scheduling/AvailabilityLayer.jsx
 *
 * Renders availability slots behind the events grid in Day/Week views.
 * Color-codes Free (transparent), Tentative (yellow), Busy (red), OOO (striped).
 */
import useSchedulingStore from '../../store/schedulingStore';
import { isSameDay } from 'date-fns';
import { timeToTopPercent, durationToHeightPercent } from '../../utils/calendarHelpers';

const AvailabilityLayer = ({ day }) => {
  const { availability } = useSchedulingStore();
  
  // Aggregate all availability slots for this day across all monitored emails
  const slots = Object.values(availability)
    .flat()
    .filter(slot => isSameDay(new Date(slot.start), day));

  if (!slots.length) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {slots.map(slot => {
        const top = timeToTopPercent(slot.start, 24);
        const duration = (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000;
        const height = durationToHeightPercent(duration, 24);
        
        let bgClass;
        switch (slot.type) {
          case 'BUSY':
            bgClass = 'bg-rose-500/10 border-rose-500/20';
            break;
          case 'TENTATIVE':
            bgClass = 'bg-amber-500/10 border-amber-500/20';
            break;
          case 'OUT_OF_OFFICE':
            // Custom CSS stripes (would normally be in index.css, using inline style fallback here)
            bgClass = 'bg-slate-500/10 border-slate-500/20 opacity-50';
            break;
          case 'FREE':
            bgClass = 'bg-emerald-500/5 border-emerald-500/10';
            break;
          default:
            bgClass = 'bg-slate-500/5 border-slate-500/10';
        }

        return (
          <div
            key={slot.id || `${slot.start}-${slot.end}`}
            className={`absolute left-0 right-0 border-l-2 ${bgClass}`}
            style={{
              top: `${top}%`,
              height: `${height}%`,
              ...(slot.type === 'OUT_OF_OFFICE' ? { backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.05) 10px, rgba(255,255,255,0.05) 20px)' } : {})
            }}
          />
        );
      })}
    </div>
  );
};

export default AvailabilityLayer;
