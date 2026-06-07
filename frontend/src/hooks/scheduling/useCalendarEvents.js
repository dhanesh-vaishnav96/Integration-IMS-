/**
 * hooks/scheduling/useCalendarEvents.js
 *
 * Fetches calendar events for the current view + date range.
 * Caches by view+date key to avoid redundant fetches.
 */
import { useEffect, useCallback } from 'react';
import useSchedulingStore from '../../store/schedulingStore';
import schedulingApi from '../../services/schedulingApi';
import { format } from 'date-fns';

const useCalendarEvents = () => {
  const {
    selectedDate, selectedView, filterState,
    setEvents, setLoading, setError,
    lastFetchKey, getFilteredEvents,
  } = useSchedulingStore();

  const fetchEvents = useCallback(async (force = false) => {
    const cacheKey = `${selectedView}:${format(selectedDate, 'yyyy-MM-dd')}:${JSON.stringify(filterState)}`;
    if (!force && lastFetchKey === cacheKey) return;

    setLoading(true);
    try {
      const params = {
        view:        selectedView,
        date:        format(selectedDate, 'yyyy-MM-dd'),
        candidateId: filterState.candidateId || undefined,
        status:      filterState.statuses?.[0] || undefined,
        type:        filterState.types?.[0] || undefined,
        department:  filterState.department || undefined,
      };
      const { data } = await schedulingApi.getCalendarView(params);
      setEvents(data.data?.events || []);
      useSchedulingStore.setState({ lastFetchKey: cacheKey });
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to fetch events');
    }
  }, [selectedDate, selectedView, filterState]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events: getFilteredEvents(),
    refetch: () => fetchEvents(true),
  };
};

export default useCalendarEvents;
