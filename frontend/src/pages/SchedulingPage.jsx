/**
 * pages/SchedulingPage.jsx
 *
 * Main container for the ATS Interview Scheduling module.
 * Light Enterprise Theme: bg-background, text-textMain, Clean layout.
 */
import { useState } from 'react';
import useCalendarEvents from '../hooks/scheduling/useCalendarEvents';
import useWebSocket from '../hooks/scheduling/useWebSocket';
import useSchedulingStore from '../store/schedulingStore';

// Components
import CalendarShell from '../components/scheduling/CalendarShell';
import InterviewModal from '../components/scheduling/InterviewModal';
import EventDetailDrawer from '../components/scheduling/EventDetailDrawer';

// Views
import WeekView from '../components/scheduling/views/WeekView';
import DayView from '../components/scheduling/views/DayView';
import MonthView from '../components/scheduling/views/MonthView';

const SchedulingPage = () => {
  // Init hooks
  const { events } = useCalendarEvents();
  useWebSocket();

  const { selectedView, openModal, selectEvent } = useSchedulingStore();

  const handleSlotClick = (data) => {
    openModal('create', data);
  };

  const renderView = () => {
    switch (selectedView) {
      case 'day':       return <DayView events={events} onEventClick={selectEvent} onSlotClick={handleSlotClick} />;
      case 'work_week': return <WeekView events={events} onEventClick={selectEvent} onSlotClick={handleSlotClick} workWeek={true} />;
      case 'month':     return <MonthView events={events} onEventClick={selectEvent} onSlotClick={handleSlotClick} />;
      case 'week':
      default:          return <WeekView events={events} onEventClick={selectEvent} onSlotClick={handleSlotClick} />;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden relative text-textMain">
      
      {/* Top Toolbar */}
      <CalendarShell />
      
      <div className="flex flex-1 overflow-hidden">
        
        {/* Main Calendar Area - Dominates viewport */}
        <div className="flex-1 flex flex-col min-w-0 bg-surface relative">
          {events === undefined ? (
             <div className="flex items-center justify-center h-full">
               <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
             </div>
          ) : (
            renderView()
          )}
        </div>

      </div>

      {/* Global Overlays */}
      <InterviewModal />
      <EventDetailDrawer />
      
    </div>
  );
};

export default SchedulingPage;
