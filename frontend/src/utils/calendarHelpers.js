/**
 * utils/calendarHelpers.js
 *
 * Date math utilities for calendar views.
 */
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, subWeeks, addMonths, subMonths,
  format, isSameDay, isSameMonth, isToday, eachDayOfInterval,
  differenceInMinutes, startOfDay,
} from 'date-fns';

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES_IN_DAY = 1440;
export const CALENDAR_START_HOUR = 0;

/** Generate an array of days for a week view */
export const getWeekDays = (anchor, startOnMonday = false) => {
  const start = startOfWeek(anchor, { weekStartsOn: startOnMonday ? 1 : 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

/** Generate an array of days for a work week (Mon-Fri) */
export const getWorkWeekDays = (anchor) => {
  const start = startOfWeek(anchor, { weekStartsOn: 1 });
  return Array.from({ length: 5 }, (_, i) => addDays(start, i));
};

/** Generate all days in a month view grid (42 days, 6 rows) */
export const getMonthGrid = (anchor) => {
  const monthStart = startOfMonth(anchor);
  const monthEnd   = endOfMonth(anchor);
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 0 });
  return eachDayOfInterval({ start: gridStart, end: gridEnd });
};

/** Navigate to next period for a given view */
export const navigateNext = (anchor, view) => {
  switch (view) {
    case 'day':       return addDays(anchor, 1);
    case 'week':      return addWeeks(anchor, 1);
    case 'work_week': return addWeeks(anchor, 1);
    case 'month':     return addMonths(anchor, 1);
    case 'agenda':    return addDays(anchor, 30);
    case 'timeline':  return addWeeks(anchor, 1);
    default:          return addWeeks(anchor, 1);
  }
};

/** Navigate to previous period */
export const navigatePrev = (anchor, view) => {
  switch (view) {
    case 'day':       return addDays(anchor, -1);
    case 'week':      return subWeeks(anchor, 1);
    case 'work_week': return subWeeks(anchor, 1);
    case 'month':     return subMonths(anchor, 1);
    case 'agenda':    return addDays(anchor, -30);
    case 'timeline':  return subWeeks(anchor, 1);
    default:          return subWeeks(anchor, 1);
  }
};

/** Format the header title for a given view */
export const getViewTitle = (anchor, view) => {
  switch (view) {
    case 'day':       return format(anchor, 'EEEE, MMMM d, yyyy');
    case 'week':
    case 'work_week': {
      const start = startOfWeek(anchor, { weekStartsOn: 0 });
      const end   = endOfWeek(anchor, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`;
    }
    case 'month':     return format(anchor, 'MMMM yyyy');
    case 'agenda':    return `${format(anchor, 'MMM d')} – ${format(addDays(anchor, 30), 'MMM d, yyyy')}`;
    case 'timeline':  return `Week of ${format(startOfWeek(anchor, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;
    default:          return format(anchor, 'MMMM yyyy');
  }
};

/**
 * Convert an event's scheduled_time to top % offset in a day column.
 * @param {Date|string} time
 * @param {number} totalHours - visible hours in grid (e.g., 24)
 */
export const timeToTopPercent = (time, totalHours = 24) => {
  const d = new Date(time);
  const minutesSinceMidnight = d.getHours() * 60 + d.getMinutes();
  return (minutesSinceMidnight / (totalHours * 60)) * 100;
};

/**
 * Convert duration in minutes to height % in a day column.
 */
export const durationToHeightPercent = (durationMinutes, totalHours = 24) => {
  return (durationMinutes / (totalHours * 60)) * 100;
};

/**
 * Snap minutes to nearest interval (5, 15, or 30).
 */
export const snapToInterval = (minutes, interval = 15) => {
  return Math.round(minutes / interval) * interval;
};

/**
 * Convert pixel Y offset to minutes from midnight.
 * @param {number} yPx         - pixel offset from top of grid
 * @param {number} gridHeightPx - total grid height
 * @param {number} totalHours   - total hours shown
 */
export const pixelToMinutes = (yPx, gridHeightPx, totalHours = 24) => {
  return (yPx / gridHeightPx) * totalHours * 60;
};

/** Color map by interview type */
export const EVENT_COLORS = {
  TECHNICAL:   { bg: 'bg-blue-50/90 border-blue-200 hover:bg-blue-100/90',   text: 'text-blue-800',   dot: 'bg-blue-600'   },
  HR:          { bg: 'bg-emerald-50/90 border-emerald-200 hover:bg-emerald-100/90', text: 'text-emerald-800', dot: 'bg-emerald-600' },
  MANAGERIAL:  { bg: 'bg-violet-50/90 border-violet-200 hover:bg-violet-100/90', text: 'text-violet-800', dot: 'bg-violet-600' },
  BEHAVIORAL:  { bg: 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/90',  text: 'text-amber-800',  dot: 'bg-amber-600'  },
  CUSTOM:      { bg: 'bg-pink-50/90 border-pink-200 hover:bg-pink-100/90',    text: 'text-pink-800',   dot: 'bg-pink-600'   },
};

export const MEETING_COLORS = ['#3B82F6','#10B981','#8B5CF6','#F59E0B','#EF4444','#EC4899','#06B6D4'];

export const STATUS_COLORS = {
  SCHEDULED:   { bg: 'bg-blue-50/90 border-blue-200 hover:bg-blue-100/90',   text: 'text-blue-800',   dot: 'bg-blue-600'   },
  COMPLETED:   { bg: 'bg-green-50/90 border-green-200 hover:bg-green-100/90', text: 'text-green-800', dot: 'bg-green-600' },
  CANCELLED:   { bg: 'bg-red-50/90 border-red-200 hover:bg-red-100/90',     text: 'text-red-800',    dot: 'bg-red-600'    },
  PROCESSING:  { bg: 'bg-orange-50/90 border-orange-200 hover:bg-orange-100/90', text: 'text-orange-800', dot: 'bg-orange-600'},
  FAILED:      { bg: 'bg-gray-50/90 border-gray-200 hover:bg-gray-100/90',    text: 'text-gray-800',   dot: 'bg-gray-600'   },
  // Fallbacks for old references
  IN_PROGRESS: { bg: 'bg-amber-50/90 border-amber-200 hover:bg-amber-100/90', text: 'text-amber-800', dot: 'bg-amber-600' },
  NO_SHOW:     { bg: 'bg-slate-50/90 border-slate-200 hover:bg-slate-100/90', text: 'text-slate-800', dot: 'bg-slate-600' },
};

export const PRIORITY_COLORS = {
  LOW:    'text-slate-500',
  MEDIUM: 'text-blue-600',
  HIGH:   'text-amber-600',
  URGENT: 'text-rose-600',
};

export { format, isSameDay, isSameMonth, isToday, differenceInMinutes, startOfDay, addDays };
