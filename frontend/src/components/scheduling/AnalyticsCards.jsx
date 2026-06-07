/**
 * components/scheduling/AnalyticsCards.jsx
 *
 * Top row KPI cards for scheduling metrics.
 */
import { useEffect } from 'react';
import useSchedulingStore from '../../store/schedulingStore';
import schedulingApi from '../../services/schedulingApi';
import { CalendarCheck, Clock, CheckCircle, XCircle } from 'lucide-react';

const AnalyticsCards = () => {
  const { analytics, setAnalytics } = useSchedulingStore();

  useEffect(() => {
    schedulingApi.getAnalytics()
      .then(res => setAnalytics(res.data.data))
      .catch(console.error);
  }, [setAnalytics]);

  const cards = [
    { title: 'Today', value: analytics.todayCount || 0, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { title: 'Upcoming', value: analytics.upcomingCount || 0, icon: CalendarCheck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { title: 'Completed', value: analytics.completedCount || 0, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { title: 'Cancelled', value: analytics.cancelledCount || 0, icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-4 bg-dark-900 border-b border-dark-700">
      {cards.map((card, i) => (
        <div key={i} className="flex items-center gap-4 p-3 bg-dark-800 border border-dark-700 rounded-xl hover:border-dark-600 transition">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${card.bg} ${card.color}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.title}</p>
            <p className="text-xl font-bold text-slate-200 leading-tight">{card.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default AnalyticsCards;
