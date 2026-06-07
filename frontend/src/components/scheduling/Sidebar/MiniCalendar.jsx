/**
 * components/scheduling/Sidebar/MiniCalendar.jsx
 *
 * Light ATS style mini calendar.
 */
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import useSchedulingStore from '../../../store/schedulingStore';

const MiniCalendar = () => {
  const { currentDate, setCurrentDate } = useSchedulingStore();

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(monthEnd);
  if (endDate.getDay() !== 6) {
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  }

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="w-full bg-surface">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-textMain">{format(currentDate, 'MMMM yyyy')}</h3>
        <div className="flex gap-1">
          <button onClick={handlePrevMonth} className="p-1 hover:bg-background rounded text-textMuted hover:text-textMain transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={handleNextMonth} className="p-1 hover:bg-background rounded text-textMuted hover:text-textMain transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-[10px] font-semibold text-textMuted uppercase">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const isSelected = isSameDay(day, currentDate);
          const isCurrentMonth = isSameMonth(day, currentDate);
          
          return (
            <button
              key={day.toISOString()}
              onClick={() => setCurrentDate(day)}
              className={`
                h-8 w-8 rounded-full text-xs font-medium flex items-center justify-center transition-colors
                ${isSelected ? 'bg-primary text-white' : 'hover:bg-background'}
                ${!isCurrentMonth && !isSelected ? 'text-textMuted opacity-50' : 'text-textMain'}
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
