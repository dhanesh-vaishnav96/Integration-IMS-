/**
 * components/scheduling/Availability/AvailabilityPanel.jsx
 *
 * Clean right sidebar for panel availability.
 * Follows DECISION 2: No polling. Event triggered refresh.
 */
import { Users, RotateCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';

const AvailabilityPanel = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800); // Simulate manual fetch
  };

  const PANELISTS = [
    { name: 'Sarah Connor', status: 'Available', role: 'Engineering Lead' },
    { name: 'John Smith', status: 'Busy', role: 'HR Manager' },
    { name: 'Mike Ross', status: 'Tentative', role: 'Senior Dev' },
  ];

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="p-4 border-b border-borderSoft flex items-center justify-between">
        <h2 className="text-sm font-bold text-textMain flex items-center gap-2">
          <Users className="w-4 h-4 text-textMuted" /> Panel Availability
        </h2>
        <button 
          onClick={handleRefresh} 
          className={`p-1.5 text-textMuted hover:text-textMain hover:bg-background rounded transition ${isRefreshing ? 'animate-spin text-primary' : ''}`}
          title="Manual Refresh"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        
        {/* Quick Add Panelist */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-2">Quick Add</label>
          <input 
            type="email" 
            placeholder="Type email to check..." 
            className="w-full bg-background border border-borderSoft rounded-lg px-3 py-2 text-sm text-textMain focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
          />
        </div>

        {/* Panelist List */}
        <div>
          <label className="block text-xs font-semibold text-textMuted uppercase tracking-wider mb-3">Saved Panelists</label>
          <div className="space-y-3">
            {PANELISTS.map((p, idx) => {
              const Icon = p.status === 'Available' ? CheckCircle2 : (p.status === 'Busy' ? XCircle : Clock);
              const color = p.status === 'Available' ? 'text-success' : (p.status === 'Busy' ? 'text-rose-500' : 'text-action');
              
              return (
                <div key={idx} className="flex items-center gap-3 p-2 hover:bg-background rounded-lg transition border border-transparent hover:border-borderSoft">
                  <div className="w-8 h-8 rounded-full bg-borderSoft text-textMuted flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-textMain truncate">{p.name}</p>
                    <p className="text-xs text-textMuted truncate">{p.role}</p>
                  </div>
                  <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityPanel;
