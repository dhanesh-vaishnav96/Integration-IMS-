/**
 * services/scheduling/WebSocketService.js
 *
 * Broadcast real-time calendar events to connected clients via Socket.IO.
 * The io instance is injected at server startup.
 */
const logger = require('../../config/logger');

let _io = null;

const WebSocketService = {
  /** Called from server.js after Socket.IO is initialized */
  init(io) {
    _io = io;
    logger.info('[WebSocketService] Socket.IO initialized');

    io.on('connection', (socket) => {
      logger.debug(`[WebSocketService] Client connected: ${socket.id}`);

      socket.on('subscribe:calendar', ({ view, startDate, endDate }) => {
        const room = `calendar:${startDate}:${endDate}`;
        socket.join(room);
        logger.debug(`[WebSocketService] ${socket.id} subscribed to ${room}`);
      });

      socket.on('disconnect', () => {
        logger.debug(`[WebSocketService] Client disconnected: ${socket.id}`);
      });
    });
  },

  broadcast(event, data) {
    if (!_io) return;
    _io.emit(event, data);
    logger.debug(`[WebSocketService] Broadcasted: ${event}`);
  },

  broadcastToRoom(room, event, data) {
    if (!_io) return;
    _io.to(room).emit(event, data);
  },

  broadcastEventCreated(interview) {
    this.broadcast('calendar:event:created', { interview });
  },

  broadcastEventUpdated(interview) {
    this.broadcast('calendar:event:updated', { interview });
  },

  broadcastEventDeleted(interviewId) {
    this.broadcast('calendar:event:deleted', { interviewId });
  },

  broadcastRecordingComplete(interviewId, assetData) {
    this.broadcast('interview:recording:complete', { interviewId, ...assetData });
  },

  broadcastTranscriptComplete(interviewId, assetData) {
    this.broadcast('interview:transcript:complete', { interviewId, ...assetData });
  },

  broadcastAvailabilityChanged(email, slots) {
    this.broadcast('availability:changed', { email, slots });
  },
};

module.exports = WebSocketService;
