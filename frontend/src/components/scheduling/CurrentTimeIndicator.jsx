/**
 * components/scheduling/CurrentTimeIndicator.jsx
 *
 * Animated red line showing the current time in Day/Week views.
 */
import { useState, useEffect } from 'react';
import { timeToTopPercent } from '../../utils/calendarHelpers';

const CurrentTimeIndicator = ({ className = '' }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const top = timeToTopPercent(now, 24);

  return (
    <div
      className={`absolute left-0 right-0 z-20 pointer-events-none ${className}`}
      style={{ top: `${top}%` }}
    >
      {/* Red dot on left */}
      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
      {/* Red line */}
      <div className="h-px bg-rose-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
    </div>
  );
};

export default CurrentTimeIndicator;
