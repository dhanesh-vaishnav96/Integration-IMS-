/**
 * components/scheduling/MiniCalendar.jsx
 *
 * Small month grid for sidebar date navigation.
 */
import { useMemo, useState } from 'react';
import { format, isSameDay, isSameMonth, isToday, addMonths, subMonths } from 'date-fns';
import { getMonthGrid } from '../../utils/calendarHelpers';
import useSchedulingStore from '../../store/schedulingStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MiniCalendar = () => {
  const { selectedDate, setDate } = useSchedulingStore();
  const [navDate, setNavDate] = useState(selectedDate);

  const days = useMemo(() => getMonthGrid(navDate), [navDate]);

  return (
    <div className="bg-dark-900 border border-dark-700 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-200">
          {format(navDate, 'MMMM yyyy')}
        </h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setNavDate(subMonths(navDate, 1))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-700">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={() => setNavDate(addMonths(navDate, 1))} className="p-1 text-slate-400 hover:text-white rounded hover:bg-dark-700">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[10px] font-medium text-slate-500 mb-2">{d}</div>
        ))}
        
        {days.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrM    = isSameMonth(day, navDate);
          const isTodayDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => { setNavDate(day); setDate(day); }}
              className={`
                h-8 rounded-full text-xs font-medium flex items-center justify-center transition-all
                ${!isCurrM ? 'text-slate-600' : 'text-slate-300'}
                ${isSelected ? 'bg-primary-600 text-white shadow-md' : 'hover:bg-dark-700'}
                ${isTodayDay && !isSelected ? 'text-primary-400 border border-primary-500/30' : ''}
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
