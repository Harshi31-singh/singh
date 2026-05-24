const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { Message, Booking, Notification } = require('../models');

class SocketHandler {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupConnections();
  }

  setupMiddleware() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error: no token'));

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userType = decoded.user_type;
        next();
      } catch {
        next(new Error('Authentication error: invalid token'));
      }
    });
  }

  setupConnections() {
    this.io.on('connection', (socket) => {
      console.log(`[Socket] User ${socket.userId} connected: ${socket.id}`);

      socket.emit('connection_established', {
        message: 'Connected to chat server',
        socketId: socket.id,
      });

      socket.on('join_chat', (data) => this.handleJoinChat(socket, data));
      socket.on('send_message', (data) => this.handleSendMessage(socket, data));
      socket.on('read_message', (data) => this.handleReadMessage(socket, data));
      socket.on('typing', (data) => this.handleTyping(socket, data));
      socket.on('stop_typing', (data) => this.handleStopTyping(socket, data));
      socket.on('disconnect', () => this.handleDisconnect(socket));
    });
  }

  async handleJoinChat(socket, { bookingId }) {
    try {
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('error', { message: 'Booking not found' });
        return;
      }

      const userId = socket.userId;
      if (
        booking.customer_id.toString() !== userId &&
        booking.provider_id.toString() !== userId
      ) {
        socket.emit('error', { message: 'Unauthorized access' });
        return;
      }

      socket.join(`booking_${bookingId}`);
      socket.bookingId = bookingId;

      const chatHistory = await Message.find({ booking_id: bookingId })
        .sort({ created_at: -1 })
        .limit(50)
        .populate('sender_id', 'name profile_photo_url');

      socket.emit('chat_history', { messages: chatHistory.reverse() });

      socket.to(`booking_${bookingId}`).emit('user_joined', {
        userId,
        message: 'User joined chat',
      });
    } catch (error) {
      console.error('[Socket] Join chat error:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  }

  async handleSendMessage(socket, { bookingId, messageText }) {
    try {
      if (!messageText || messageText.trim().length === 0) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }
      if (messageText.length > 1000) {
        socket.emit('error', { message: 'Message too long (max 1000 chars)' });
        return;
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('error', { message: 'Booking not found' });
        return;
      }

      const receiverId =
        booking.customer_id.toString() === socket.userId
          ? booking.provider_id
          : booking.customer_id;

      const message = await Message.create({
        booking_id: bookingId,
        sender_id: socket.userId,
        receiver_id: receiverId,
        message_text: messageText.trim(),
        is_read: false,
        created_at: new Date(),
      });

      await message.populate('sender_id', 'name profile_photo_url');

      this.io.to(`booking_${bookingId}`).emit('new_message', {
        id: message._id,
        sender_id: message.sender_id,
        message_text: message.message_text,
        created_at: message.created_at,
        is_read: message.is_read,
      });

      socket.emit('message_sent', { id: message._id, status: 'sent' });

      // Offline notification
      await this.sendOfflineNotification(bookingId, socket.userId, receiverId);
    } catch (error) {
      console.error('[Socket] Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  }

  async handleReadMessage(socket, { messageId, bookingId }) {
    try {
      await Message.findByIdAndUpdate(messageId, { is_read: true });
      this.io.to(`booking_${bookingId}`).emit('message_read', {
        messageId,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('[Socket] Read message error:', error);
    }
  }

  handleTyping(socket, { bookingId }) {
    socket.to(`booking_${bookingId}`).emit('user_typing', { userId: socket.userId });
  }

  handleStopTyping(socket, { bookingId }) {
    socket.to(`booking_${bookingId}`).emit('user_stop_typing', { userId: socket.userId });
  }

  handleDisconnect(socket) {
    console.log(`[Socket] User ${socket.userId} disconnected`);
    if (socket.bookingId) {
      socket.to(`booking_${socket.bookingId}`).emit('user_left', {
        userId: socket.userId,
        message: 'User left chat',
      });
    }
  }

  async sendOfflineNotification(bookingId, senderId, receiverId) {
    try {
      const sockets = await this.io.in(`booking_${bookingId}`).fetchSockets();
      const receiverOnline = sockets.some((s) => s.userId?.toString() === receiverId?.toString());

      if (!receiverOnline) {
        await Notification.create({
          user_id: receiverId,
          type: 'new_message',
          title: 'New message',
          message: 'You have a new message',
          related_booking_id: bookingId,
          is_read: false,
        });
      }
    } catch (error) {
      console.error('[Socket] Offline notification error:', error);
    }
  }

  async sendToUser(userId, event, data) {
    const sockets = await this.io.fetchSockets();
    sockets.filter((s) => s.userId === userId).forEach((s) => s.emit(event, data));
  }
}

module.exports = SocketHandler;
