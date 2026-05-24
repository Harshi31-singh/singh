require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const SocketHandler = require('./socket/socketHandler');
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const chatRoutes = require('./routes/chat');
const paymentRoutes = require('./routes/payments');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

// ─── Socket.io ────────────────────────────────
const socketHandler = new SocketHandler(server);

// ─── Security & Middleware ────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// ─── Routes ───────────────────────────────────
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'AYARSHI API is running', timestamp: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error handler
app.use(errorHandler);

// ─── Database & Server ─────────────────────────
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ayarshi';

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    server.listen(PORT, () => {
      console.log(`🚀 AYARSHI API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, server, socketHandler };
