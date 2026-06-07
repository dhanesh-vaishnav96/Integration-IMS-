/**
 * components/scheduling/FilterPanel.jsx
 *
 * Left sidebar containing MiniCalendar and filter toggles.
 */
import useSchedulingStore from '../../store/schedulingStore';
import MiniCalendar from './MiniCalendar';
import { Search } from 'lucide-react';

const FilterPanel = () => {
  const { filterState, setFilter, clearFilters } = useSchedulingStore();

  const handleToggle = (key, value) => {
    const current = filterState[key] || [];
    if (current.includes(value)) {
      setFilter(key, current.filter(v => v !== value));
    } else {
      setFilter(key, [...current, value]);
    }
  };

  const types = ['TECHNICAL', 'HR', 'MANAGERIAL', 'BEHAVIORAL', 'CUSTOM'];
  const statuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];

  return (
    <div className="w-64 flex-shrink-0 border-r border-dark-700 bg-dark-800 flex flex-col h-full overflow-y-auto custom-scrollbar p-4 space-y-6 hidden md:flex">
      
      {/* Date Picker */}
      <MiniCalendar />

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
        <input 
          type="text"
          placeholder="Search interviews..."
          className="w-full bg-dark-900 border border-dark-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:border-primary-500 outline-none transition"
          value={filterState.search}
          onChange={(e) => setFilter('search', e.target.value)}
        />
      </div>

    </div>
  );
};

export default FilterPanel;
