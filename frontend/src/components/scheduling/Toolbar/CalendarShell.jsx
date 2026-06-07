/**
 * components/scheduling/Toolbar/CalendarShell.jsx
 *
 * Clean white toolbar for ATS Scheduling page.
 */
import { ChevronLeft, ChevronRight, Menu, Plus } from 'lucide-react';
import useSchedulingStore from '../../../store/schedulingStore';
import { format, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';

const VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'work_week', label: 'Work Week' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'agenda', label: 'Agenda' }
];

const CalendarShell = ({ toggleSidebar }) => {
  const { selectedView, setView, currentDate, setCurrentDate, openModal } = useSchedulingStore();

  const handlePrev = () => {
    switch(selectedView) {
      case 'day': setCurrentDate(subDays(currentDate, 1)); break;
      case 'month': setCurrentDate(subMonths(currentDate, 1)); break;
      case 'work_week':
      case 'week':
      default: setCurrentDate(subWeeks(currentDate, 1)); break;
    }
  };

  const handleNext = () => {
    switch(selectedView) {
      case 'day': setCurrentDate(addDays(currentDate, 1)); break;
      case 'month': setCurrentDate(addMonths(currentDate, 1)); break;
      case 'work_week':
      case 'week':
      default: setCurrentDate(addWeeks(currentDate, 1)); break;
    }
  };

  const getDateText = () => {
    if (selectedView === 'month') return format(currentDate, 'MMMM yyyy');
    if (selectedView === 'day') return format(currentDate, 'MMMM d, yyyy');
    return format(currentDate, 'MMMM yyyy'); // Simplify for ATS
  };

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-surface border-b border-borderSoft z-30">
      
      {/* Left side: Nav */}
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 -ml-2 text-textMuted hover:text-textMain" onClick={toggleSidebar}>
          <Menu className="w-5 h-5" />
        </button>
        
        <button 
          onClick={() => setCurrentDate(new Date())}
          className="px-4 py-1.5 text-sm font-medium border border-borderSoft text-textMain rounded-lg hover:bg-background transition"
        >
          Today
        </button>

        <div className="flex items-center gap-1 bg-background border border-borderSoft rounded-lg p-0.5">
          <button onClick={handlePrev} className="p-1 text-textMuted hover:text-textMain hover:bg-borderSoft rounded transition">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={handleNext} className="p-1 text-textMuted hover:text-textMain hover:bg-borderSoft rounded transition">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <h2 className="text-xl font-bold text-textMain ml-2">
          {getDateText()}
        </h2>
      </div>

      {/* Center: View Switcher */}
      <div className="hidden lg:flex items-center bg-background border border-borderSoft rounded-lg p-1">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              selectedView === v.id 
                ? 'bg-surface text-primary shadow-sm ring-1 ring-borderSoft' 
                : 'text-textMuted hover:text-textMain'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => openModal('create')}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-[#112d70] text-white rounded-lg text-sm font-medium transition"
        >
          <Plus className="w-4 h-4" /> Schedule Interview
        </button>
      </div>

    </div>
  );
};

export default CalendarShell;
