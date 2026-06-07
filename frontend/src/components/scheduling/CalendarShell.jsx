/**
 * components/scheduling/CalendarShell.jsx
 *
 * Top toolbar for the scheduling module: view switcher, date navigator, add button.
 */
import useSchedulingStore from '../../store/schedulingStore';
import { ChevronLeft, ChevronRight, Plus, Filter } from 'lucide-react';
import { isToday } from 'date-fns';
import { navigateNext, navigatePrev, getViewTitle } from '../../utils/calendarHelpers';

const CalendarShell = ({ toggleSidebar }) => {
  const { selectedDate, selectedView, setDate, setView, openModal } = useSchedulingStore();

  const handlePrev = () => setDate(navigatePrev(selectedDate, selectedView));
  const handleNext = () => setDate(navigateNext(selectedDate, selectedView));
  const handleToday = () => setDate(new Date());

  const title = getViewTitle(selectedDate, selectedView);

  return (
    <div className="h-[72px] bg-surface border-b border-borderSoft flex items-center justify-between px-8 z-20 flex-shrink-0 shadow-sm">
      
      {/* Left side: Navigation */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <button onClick={toggleSidebar} className="p-2 text-slate-500 hover:text-primary-800 rounded-[12px] hover:bg-slate-50 md:hidden transition-colors">
            <Filter className="w-5 h-5" />
          </button>
          
          <button 
            onClick={handleToday}
            className="px-4 py-2 text-sm font-semibold text-slate-700 hover:text-primary-800 border border-borderSoft hover:bg-slate-50 rounded-[12px] transition-colors shadow-sm disabled:opacity-50"
            disabled={isToday(selectedDate)}
          >
            Today
          </button>
          
          <div className="flex items-center bg-surface border border-borderSoft rounded-[12px] overflow-hidden shadow-sm">
            <button onClick={handlePrev} className="px-3 py-2 text-slate-500 hover:text-primary-800 hover:bg-slate-50 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-[1px] h-5 bg-borderSoft"></div>
            <button onClick={handleNext} className="px-3 py-2 text-slate-500 hover:text-primary-800 hover:bg-slate-50 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <h2 className="text-[22px] font-bold text-textMain min-w-[200px] tracking-tight">{title}</h2>
      </div>

      {/* Right side: Actions & Views */}
      <div className="flex items-center gap-4">
        <div className="bg-slate-50 p-1 rounded-[12px] border border-borderSoft flex items-center text-sm font-semibold">
          {[
            { id: 'day', label: 'Day' },
            { id: 'week', label: 'Week' },
            { id: 'month', label: 'Month' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`px-4 py-1.5 rounded-[8px] transition-all ${
                selectedView === v.id 
                  ? 'bg-white text-primary-800 shadow-sm border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100 border border-transparent'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <button 
          onClick={() => openModal('create')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Schedule
        </button>
      </div>

    </div>
  );
};

export default CalendarShell;
