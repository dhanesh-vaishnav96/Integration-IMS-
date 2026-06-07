/**
 * components/scheduling/Analytics/AnalyticsCards.jsx
 *
 * Clean 4-card ATS style analytics row.
 * Includes: Today, Upcoming, Completed, Cancelled.
 */
import { useEffect, useState } from 'react';
import schedulingApi from '../../../services/schedulingApi';
import { CalendarClock, CalendarDays, CheckCircle2, XCircle } from 'lucide-react';

const AnalyticsCards = () => {
  const [stats, setStats] = useState({ todayCount: 0, upcomingCount: 0, completedCount: 0, cancelledCount: 0 });

  useEffect(() => {
    schedulingApi.getAnalytics()
      .then(res => setStats(res.data.data || stats))
      .catch(console.error);
  }, []);

  const cards = [
    { label: 'Today', value: stats.todayCount, icon: CalendarClock, color: 'text-primary' },
    { label: 'Upcoming', value: stats.upcomingCount, icon: CalendarDays, color: 'text-action' },
    { label: 'Completed', value: stats.completedCount, icon: CheckCircle2, color: 'text-success' },
    { label: 'Cancelled', value: stats.cancelledCount, icon: XCircle, color: 'text-rose-500' },
  ];

  return (
    <div className="bg-surface border-b border-borderSoft p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {cards.map((c, i) => {
          const Icon = c.icon;
          return (
            <div key={i} className="bg-surface border border-borderSoft rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-shadow">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-textMuted uppercase tracking-wider">{c.label}</span>
                <span className="text-2xl font-bold text-textMain mt-1">{c.value}</span>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-background ${c.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnalyticsCards;
