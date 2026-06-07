/**
 * components/scheduling/Sidebar/FilterPanel.jsx
 *
 * Clean left sidebar for calendar navigation and filtering.
 * ATS style: light background, soft borders.
 */
import { Search } from 'lucide-react';
import MiniCalendar from './MiniCalendar';

const CATEGORIES = [
  { id: 'Technical', label: 'Technical' },
  { id: 'HR', label: 'HR Screening' },
  { id: 'Managerial', label: 'Managerial' },
  { id: 'Behavioral', label: 'Behavioral' },
];

const FilterPanel = () => {
  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 border-b border-borderSoft">
        <MiniCalendar />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        {/* Search */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted" />
            <input 
              type="text" 
              placeholder="Search interviews..." 
              className="w-full bg-background border border-borderSoft rounded-lg pl-9 pr-3 py-2 text-sm text-textMain focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
            />
          </div>
        </div>

        {/* Categories */}
        <div>
          <h3 className="text-xs font-semibold text-textMuted uppercase tracking-wider mb-3">Interview Categories</h3>
          <div className="space-y-2">
            {CATEGORIES.map(cat => (
              <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" className="peer sr-only" defaultChecked />
                  <div className="w-4 h-4 border border-borderSoft rounded bg-surface peer-checked:bg-primary peer-checked:border-primary transition" />
                  <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 14" fill="none">
                    <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" stroke="currentColor"/>
                  </svg>
                </div>
                <span className="text-sm text-textMain group-hover:text-primary transition">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilterPanel;
