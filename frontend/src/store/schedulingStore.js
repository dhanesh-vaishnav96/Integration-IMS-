/**
 * store/schedulingStore.js
 *
 * Zustand store for the Interview Scheduling Module.
 * Central state for events, UI, drag-drop, filters, and availability.
 */
import { create } from 'zustand';

const useSchedulingStore = create((set, get) => ({
  // ─── Navigation ─────────────────────────────────────────────────────────────
  selectedDate: new Date(),
  selectedView: 'week',
  timezone:     Intl.DateTimeFormat().resolvedOptions().timeZone,

  setDate:     (date)    => set({ selectedDate: new Date(date) }),
  setView:     (view)    => set({ selectedView: view }),
  setTimezone: (tz)      => set({ timezone: tz }),

  // ─── Event Data ──────────────────────────────────────────────────────────────
  events:       new Map(),  // Map<id, event>
  isLoading:    false,
  error:        null,
  lastFetchKey: null,       // cache key to prevent duplicate fetches

  setEvents: (eventArray) => {
    const map = new Map();
    eventArray.forEach(e => map.set(e.id || e._id, e));
    set({ events: map, isLoading: false, error: null });
  },

  addEvent: (event) => set((state) => {
    const map = new Map(state.events);
    map.set(event.id || event._id, event);
    return { events: map };
  }),

  updateEvent: (event) => set((state) => {
    const map = new Map(state.events);
    map.set(event.id || event._id, event);
    return { events: map };
  }),

  removeEvent: (id) => set((state) => {
    const map = new Map(state.events);
    map.delete(id);
    return { events: map };
  }),

  setLoading: (isLoading) => set({ isLoading }),
  setError:   (error)     => set({ error, isLoading: false }),

  // Derived: events as sorted array
  getEventArray: () => {
    return Array.from(get().events.values())
      .sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
  },

  // ─── Availability ────────────────────────────────────────────────────────────
  availability: {},   // { [email]: slot[] }
  setAvailability: (data) => set({ availability: data }),

  // ─── Selected Event / Drawer ─────────────────────────────────────────────────
  selectedEventId: null,
  drawerOpen:      false,

  selectEvent: (eventOrId) => {
    const id = typeof eventOrId === 'object' ? (eventOrId.id || eventOrId._id) : eventOrId;
    set({ selectedEventId: id, drawerOpen: true });
  },
  closeDrawer: ()   => set({ selectedEventId: null, drawerOpen: false }),

  getSelectedEvent: () => {
    const { selectedEventId, events } = get();
    return selectedEventId ? events.get(selectedEventId) : null;
  },

  // ─── Modal ───────────────────────────────────────────────────────────────────
  modalState: { open: false, mode: 'create', initialData: {} },

  openModal:  (mode = 'create', initialData = {}) => set({ modalState: { open: true, mode, initialData } }),
  closeModal: () => set({ modalState: { open: false, mode: 'create', initialData: {} } }),

  // ─── Filters ─────────────────────────────────────────────────────────────────
  filterState: {
    types:       [],
    statuses:    [],
    candidateId: null,
    panelistEmail: null,
    department:  null,
    search:      '',
  },

  setFilter:    (key, value) => set(state => ({ filterState: { ...state.filterState, [key]: value } })),
  clearFilters: ()           => set({ filterState: { types: [], statuses: [], candidateId: null, panelistEmail: null, department: null, search: '' } }),

  // Derived: filtered event array
  getFilteredEvents: () => {
    const { filterState } = get();
    let arr = get().getEventArray();

    if (filterState.search) {
      const q = filterState.search.toLowerCase();
      arr = arr.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.candidate?.name || '').toLowerCase().includes(q) ||
        (e.organizer_email || '').toLowerCase().includes(q)
      );
    }
    if (filterState.types?.length)
      arr = arr.filter(e => filterState.types.includes(e.type));
    if (filterState.statuses?.length)
      arr = arr.filter(e => filterState.statuses.includes(e.status));
    if (filterState.candidateId)
      arr = arr.filter(e => (e.candidate_id === filterState.candidateId || e.candidate?.id === filterState.candidateId));
    if (filterState.department)
      arr = arr.filter(e => e.department === filterState.department);

    return arr;
  },

  // ─── Drag & Drop ─────────────────────────────────────────────────────────────
  dragState: {
    isDragging:   false,
    eventId:      null,
    ghostEl:      null,
    originTime:   null,
    currentTime:  null,
    snapInterval: 15,   // minutes
  },

  setSnapInterval:  (mins)  => set(state => ({ dragState: { ...state.dragState, snapInterval: mins } })),
  startDrag:        (eventId, originTime) =>
    set({ dragState: { ...get().dragState, isDragging: true, eventId, originTime, currentTime: originTime } }),
  updateDrag:       (currentTime) =>
    set(state => ({ dragState: { ...state.dragState, currentTime } })),
  endDrag:          ()      =>
    set({ dragState: { ...get().dragState, isDragging: false, eventId: null, originTime: null, currentTime: null } }),

  // ─── Analytics ───────────────────────────────────────────────────────────────
  analytics: { todayCount: 0, upcomingCount: 0, completedCount: 0, cancelledCount: 0, totalCount: 0 },
  setAnalytics: (data) => set({ analytics: data }),
}));

export default useSchedulingStore;
