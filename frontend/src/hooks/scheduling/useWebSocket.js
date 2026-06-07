/**
 * hooks/scheduling/useWebSocket.js
 *
 * Socket.IO client connection for real-time calendar updates.
 */
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import useSchedulingStore from '../../store/schedulingStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const useWebSocket = () => {
  const socketRef = useRef(null);
  const { addEvent, updateEvent, removeEvent } = useSchedulingStore();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
    });

    socket.on('calendar:event:created', ({ interview }) => {
      addEvent(interview);
    });

    socket.on('calendar:event:updated', ({ interview }) => {
      updateEvent(interview);
    });

    socket.on('calendar:event:deleted', ({ interviewId }) => {
      removeEvent(interviewId);
    });

    socket.on('interview:recording:complete', ({ interviewId, ...assetData }) => {
      // Update the event in store with recording info
      const { events } = useSchedulingStore.getState();
      const event = events.get(interviewId);
      if (event) updateEvent({ ...event, recording_status: 'UPLOADED', ...assetData });
    });

    socket.on('interview:transcript:complete', ({ interviewId, ...assetData }) => {
      const { events } = useSchedulingStore.getState();
      const event = events.get(interviewId);
      if (event) updateEvent({ ...event, transcript_status: 'UPLOADED', ...assetData });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [addEvent, updateEvent, removeEvent]);

  return socketRef;
};

export default useWebSocket;
