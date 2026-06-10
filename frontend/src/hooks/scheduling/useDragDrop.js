/**
 * hooks/scheduling/useDragDrop.js
 *
 * Pointer-event based drag & drop for calendar events.
 * Supports: mouse, touch, keyboard (ArrowKeys + Enter).
 * Snap intervals: 5, 15, 30 minutes.
 */
import { useCallback, useRef } from 'react';
import useSchedulingStore from '../../store/schedulingStore';
import schedulingApi from '../../services/schedulingApi';
import { snapToInterval, pixelToMinutes } from '../../utils/calendarHelpers';
import { addMinutes } from 'date-fns';

const useDragDrop = (gridRef) => {
  const { dragState, startDrag, updateDrag, endDrag, updateEvent } = useSchedulingStore();
  const dragData = useRef(null);

  const onPointerDown = useCallback((e, event) => {
    // If clicking on resize handle, let onPointerDownResize handle it
    if (e.target.dataset.resizeHandle) return;
    if (e.button !== 0) return; // Left click only
    e.preventDefault();
    e.stopPropagation();

    dragData.current = {
      eventId:      event.id || event._id,
      originTime:   event.scheduled_time,
      originY:      e.clientY,
      duration:     event.duration_minutes || 60,
      event,
    };

    startDrag(event.id || event._id, event.scheduled_time);

    const handleMove = (e) => {
      if (!dragData.current) return;
      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const y    = (e.clientY ?? e.touches?.[0]?.clientY ?? dragData.current.originY) - rect.top;
      const totalMinutes = pixelToMinutes(y, rect.height, 24);
      const snapped = snapToInterval(totalMinutes, dragData.current.snapInterval || 15);

      const newTime = new Date();
      newTime.setHours(0, 0, 0, 0);
      newTime.setMinutes(snapped);

      // Preserve the original date, only change time
      const orig = new Date(dragData.current.originTime);
      newTime.setFullYear(orig.getFullYear(), orig.getMonth(), orig.getDate());

      updateDrag(newTime.toISOString());
    };

    const handleUp = async () => {
      if (!dragData.current) return;
      const { eventId, duration } = dragData.current;
      const newTime = dragState.currentTime || dragData.current.originTime;

      // Optimistic update
      updateEvent({ ...dragData.current.event, scheduled_time: newTime });

      // API call
      try {
        const { data } = await schedulingApi.updateInterview(eventId, {
          scheduled_time: newTime,
          duration_minutes: duration,
        });
        if (data.data) updateEvent(data.data);
      } catch {
        // Revert optimistic update
        updateEvent(dragData.current.event);
      }

      dragData.current = null;
      endDrag();
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [dragState, startDrag, updateDrag, endDrag, updateEvent, gridRef]);

  // Handle Resizing (changing duration)
  const onPointerDownResize = useCallback((e, event) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startDuration = event.duration_minutes || 60;
    const originY = e.clientY;

    const handleMove = (moveEvent) => {
      const grid = gridRef.current;
      if (!grid) return;
      
      const rect = grid.getBoundingClientRect();
      // Calculate delta pixels from start of drag
      const deltaY = moveEvent.clientY - originY;
      // Convert pixels to minutes based on 24h grid
      const deltaMinutes = pixelToMinutes(deltaY, rect.height, 24);
      
      // Calculate new duration and snap it
      const newDuration = Math.max(10, snapToInterval(startDuration + deltaMinutes, 15));
      
      // Optimistic update for visual feedback
      updateEvent({ ...event, duration_minutes: newDuration });
    };

    const handleUp = async (upEvent) => {
      const grid = gridRef.current;
      if (grid) {
        const rect = grid.getBoundingClientRect();
        const deltaY = upEvent.clientY - originY;
        const deltaMinutes = pixelToMinutes(deltaY, rect.height, 24);
        const finalDuration = Math.max(10, snapToInterval(startDuration + deltaMinutes, 15));

        try {
          const { data } = await schedulingApi.updateInterview(event.id || event._id, {
            duration_minutes: finalDuration,
          });
          if (data.data) updateEvent(data.data);
        } catch {
          // Revert optimistic update
          updateEvent({ ...event, duration_minutes: startDuration });
        }
      }

      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [updateEvent, gridRef]);

  // Keyboard accessibility
  const onKeyDown = useCallback(async (e, event) => {
    const snapMin = dragState.snapInterval || 15;
    const id = event.id || event._id;

    if (e.key === 'ArrowRight') {
      const newTime = addMinutes(new Date(event.scheduled_time), snapMin).toISOString();
      updateEvent({ ...event, scheduled_time: newTime });
      await schedulingApi.updateInterview(id, { scheduled_time: newTime });
    }
    if (e.key === 'ArrowLeft') {
      const newTime = addMinutes(new Date(event.scheduled_time), -snapMin).toISOString();
      updateEvent({ ...event, scheduled_time: newTime });
      await schedulingApi.updateInterview(id, { scheduled_time: newTime });
    }
  }, [dragState.snapInterval, updateEvent]);

  return { onPointerDown, onPointerDownResize, onKeyDown, isDragging: dragState.isDragging, dragEventId: dragState.eventId };
};

export default useDragDrop;
