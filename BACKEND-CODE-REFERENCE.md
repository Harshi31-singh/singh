================================================================================
                        AYARSHI BACKEND - COMPLETE CODE
================================================================================

PROJECT STRUCTURE:
backend/
├── src/
│   ├── app.js                      # Main Express server
│   ├── models/
│   │   ├── User.js                 # User schema
│   │   ├── Booking.js              # Booking schema
│   │   ├── Message.js              # Chat messages
│   │   ├── Payment.js              # Payment records
│   │   ├── Notification.js         # Notifications
│   │   └── index.js                # Export all models
│   ├── routes/
│   │   ├── auth.js                 # Authentication endpoints
│   │   ├── bookings.js             # Booking endpoints
│   │   ├── chat.js                 # Chat endpoints
│   │   └── payments.js             # Payment endpoints
│   ├── middleware/
│   │   ├── auth.js                 # JWT auth middleware
│   │   └── errorHandler.js         # Error handling
│   ├── services/
│   │   └── paymentService.js       # Razorpay + Stripe logic
│   └── socket/
│       └── socketHandler.js        # Socket.io real-time chat
├── Dockerfile
├── package.json
└── .env.example

================================================================================
FILE 1: package.json
================================================================================

{
  "name": "ayarshi-backend",
  "version": "1.0.0",
  "description": "AYARSHI - Backend API with real-time chat and payments",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js",
    "test": "jest"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^7.3.1",
    "morgan": "^1.10.0",
    "razorpay": "^2.8.6",
    "socket.io": "^4.6.1",
    "stripe": "^12.9.0",
    "validator": "^13.9.0"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "nodemon": "^3.0.1",
    "socket.io-client": "^4.6.1",
    "supertest": "^6.3.3"
  }
}

================================================================================
FILE 2: .env.example
================================================================================

# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/ayarshi

# JWT
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_EXPIRES_IN=7d

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Razorpay
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxx

# Stripe
STRIPE_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# Redis (optional - for scaling)
REDIS_HOST=localhost
REDIS_PORT=6379

================================================================================
FILE 3: src/app.js (MAIN SERVER)
================================================================================

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

================================================================================
FILE 4: src/models/User.js
================================================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    user_type: {
      type: String,
      enum: ['customer', 'provider', 'admin'],
      default: 'customer',
    },
    phone: {
      type: String,
      trim: true,
    },
    profile_photo_url: {
      type: String,
      default: '',
    },
    is_active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

================================================================================
FILE 5: src/models/Booking.js
================================================================================

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    service_name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    payment_status: {
      type: String,
      enum: ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    scheduled_at: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Booking', bookingSchema);

================================================================================
FILE 6: src/models/Message.js
================================================================================

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  booking_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true,
  },
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  message_text: {
    type: String,
    required: true,
    maxlength: 1000,
  },
  is_read: {
    type: Boolean,
    default: false,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

messageSchema.index({ booking_id: 1, created_at: -1 });
messageSchema.index({ receiver_id: 1, is_read: 1 });

module.exports = mongoose.model('Message', messageSchema);

================================================================================
FILE 7: src/models/Payment.js
================================================================================

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'success', 'failed', 'cancelled', 'refunded', 'disputed'],
      default: 'pending',
    },
    payment_method: {
      type: String,
      enum: ['razorpay', 'stripe'],
      required: true,
    },
    // Razorpay fields
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,
    // Stripe fields
    stripe_payment_intent_id: String,
    stripe_charge_id: String,
    // Refund fields
    refund_id: String,
    stripe_refund_id: String,
    refund_amount: Number,
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);

================================================================================
FILE 8: src/models/Notification.js
================================================================================

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['new_message', 'booking_update', 'payment_success', 'payment_failed'],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    related_booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    is_read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

================================================================================
FILE 9: src/models/index.js
================================================================================

const User = require('./User');
const Booking = require('./Booking');
const Message = require('./Message');
const Payment = require('./Payment');
const Notification = require('./Notification');

module.exports = { User, Booking, Message, Payment, Notification };

================================================================================
FILE 10: src/middleware/auth.js
================================================================================

const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({ success: false, message: 'Access forbidden' });
    }
    next();
  };
};

module.exports = { authenticate, authorize };

================================================================================
FILE 11: src/middleware/errorHandler.js
================================================================================

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose duplicate key error
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

================================================================================
FILE 12: src/routes/auth.js
================================================================================

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { authenticate } = require('../middleware/auth');

const signToken = (id, user_type) => {
  return jwt.sign({ id, user_type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/v1/auth/register
 */
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, user_type, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const user = await User.create({ name, email, password, user_type, phone });
    const token = signToken(user._id, user.user_type);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          user_type: user.user_type,
          phone: user.phone,
          profile_photo_url: user.profile_photo_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account deactivated' });
    }

    const token = signToken(user._id, user.user_type);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          user_type: user.user_type,
          phone: user.phone,
          profile_photo_url: user.profile_photo_url,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 */
router.get('/me', authenticate, async (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
});

module.exports = router;

================================================================================
FILE 13: src/routes/bookings.js
================================================================================

const express = require('express');
const router = express.Router();
const { Booking } = require('../models');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/v1/bookings
 * Create a new booking
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { provider_id, service_name, description, amount, scheduled_at } = req.body;

    if (!provider_id || !service_name || !amount) {
      return res.status(400).json({ success: false, message: 'provider_id, service_name, and amount are required' });
    }

    const booking = await Booking.create({
      customer_id: req.user._id,
      provider_id,
      service_name,
      description,
      amount,
      scheduled_at,
    });

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/bookings
 * Get all bookings for the authenticated user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const bookings = await Booking.find({
      $or: [{ customer_id: userId }, { provider_id: userId }],
    })
      .populate('customer_id', 'name email profile_photo_url')
      .populate('provider_id', 'name email profile_photo_url')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/bookings/:id
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customer_id', 'name email profile_photo_url phone')
      .populate('provider_id', 'name email profile_photo_url phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const userId = req.user._id.toString();
    if (booking.customer_id._id.toString() !== userId && booking.provider_id._id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/bookings/:id/status
 */
router.patch('/:id/status', authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

================================================================================
FILE 14: src/routes/chat.js
================================================================================

const express = require('express');
const router = express.Router();
const { Message, Booking } = require('../models');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/v1/chat/conversations
 * Get all conversations for the current user
 */
router.get('/conversations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user._id;

    const bookings = await Booking.find({
      $or: [{ customer_id: userId }, { provider_id: userId }],
    })
      .populate('customer_id', 'name profile_photo_url')
      .populate('provider_id', 'name profile_photo_url')
      .lean();

    const conversations = await Promise.all(
      bookings.map(async (booking) => {
        const lastMessage = await Message.findOne({ booking_id: booking._id })
          .sort({ created_at: -1 })
          .lean();

        const unreadCount = await Message.countDocuments({
          booking_id: booking._id,
          receiver_id: userId,
          is_read: false,
        });

        const otherUser =
          booking.customer_id._id.toString() === userId.toString()
            ? booking.provider_id
            : booking.customer_id;

        return {
          bookingId: booking._id,
          otherUser,
          serviceName: booking.service_name,
          lastMessage: lastMessage?.message_text || '',
          lastMessageTime: lastMessage?.created_at || booking.createdAt,
          unreadCount,
          bookingStatus: booking.status,
        };
      })
    );

    conversations.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/chat/:bookingId
 * Get messages for a booking
 */
router.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user._id.toString();

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.customer_id.toString() !== userId && booking.provider_id.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ booking_id: bookingId })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender_id', 'name profile_photo_url');

    const total = await Message.countDocuments({ booking_id: bookingId });

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          perPage: limit,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/chat/mark-read/:bookingId
 */
router.post('/mark-read/:bookingId', authenticate, async (req, res, next) => {
  try {
    const { bookingId } = req.params;

    await Message.updateMany(
      { booking_id: bookingId, receiver_id: req.user._id, is_read: false },
      { is_read: true }
    );

    res.status(200).json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

================================================================================
FILE 15: src/routes/payments.js
================================================================================

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/v1/payments/create-order  (Razorpay)
 */
router.post('/create-order', authenticate, async (req, res, next) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId || !amount) {
      return res.status(400).json({ success: false, message: 'bookingId and amount are required' });
    }

    const order = await paymentService.createRazorpayOrder(bookingId, amount, req.user._id);
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/verify  (Razorpay)
 */
router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: 'Missing payment verification fields' });
    }

    const result = await paymentService.verifyRazorpayPayment(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );
    res.status(200).json({ success: true, message: 'Payment verified', data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/create-payment-intent  (Stripe)
 */
router.post('/create-payment-intent', authenticate, async (req, res, next) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId || !amount) {
      return res.status(400).json({ success: false, message: 'bookingId and amount are required' });
    }

    const result = await paymentService.createStripePaymentIntent(bookingId, amount, req.user._id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/confirm-stripe  (Stripe)
 */
router.post('/confirm-stripe', authenticate, async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, message: 'paymentIntentId is required' });
    }

    const result = await paymentService.confirmStripePayment(paymentIntentId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/refund
 */
router.post('/refund', authenticate, async (req, res, next) => {
  try {
    const { bookingId, amount, reason } = req.body;
    if (!bookingId || !amount || !reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const refund = await paymentService.refundRazorpay(bookingId, amount, reason);
    res.status(200).json({ success: true, data: refund });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/payments/:bookingId
 */
router.get('/:bookingId', authenticate, async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentDetails(req.params.bookingId);
    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/payments/webhook/razorpay
 */
router.post('/webhook/razorpay', express.raw({ type: 'application/json' }), async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const event = JSON.parse(req.body);
    await paymentService.handleRazorpayWebhook(event, signature);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;

================================================================================
FILE 16: src/services/paymentService.js
================================================================================

const crypto = require('crypto');
const { Payment, Booking } = require('../models');

let razorpay;
let stripe;

// Lazy-load payment providers
const getRazorpay = () => {
  if (!razorpay) {
    const Razorpay = require('razorpay');
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

const getStripe = () => {
  if (!stripe) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
};

class PaymentService {
  // ─────────────────────────────────────────────
  //  RAZORPAY
  // ─────────────────────────────────────────────

  async createRazorpayOrder(bookingId, amount, customerId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const order = await getRazorpay().orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `booking_${bookingId}`,
      notes: { booking_id: bookingId, customer_id: customerId },
    });

    await Payment.create({
      booking_id: bookingId,
      customer_id: customerId,
      provider_id: booking.provider_id,
      amount,
      currency: 'INR',
      razorpay_order_id: order.id,
      status: 'pending',
      payment_method: 'razorpay',
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  async verifyRazorpayPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature) {
    const signatureBody = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureBody)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) throw new Error('Invalid payment signature');

    const paymentDetails = await getRazorpay().payments.fetch(razorpayPaymentId);
    if (paymentDetails.status !== 'captured') throw new Error('Payment not captured');

    const payment = await Payment.findOneAndUpdate(
      { razorpay_order_id: razorpayOrderId },
      {
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: 'success',
        updated_at: new Date(),
      },
      { new: true }
    );

    await Booking.findByIdAndUpdate(payment.booking_id, { payment_status: 'paid' });
    return { success: true, payment };
  }

  async refundRazorpay(bookingId, amount, reason) {
    const payment = await Payment.findOne({ booking_id: bookingId });
    if (!payment?.razorpay_payment_id) throw new Error('Payment not found');

    const refund = await getRazorpay().payments.refund(payment.razorpay_payment_id, {
      amount: Math.round(amount * 100),
      notes: { booking_id: bookingId, reason },
    });

    await Payment.findByIdAndUpdate(payment._id, {
      status: 'refunded',
      refund_id: refund.id,
      refund_amount: amount,
      updated_at: new Date(),
    });

    return { success: true, refund };
  }

  // ─────────────────────────────────────────────
  //  STRIPE
  // ─────────────────────────────────────────────

  async createStripePaymentIntent(bookingId, amount, customerId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) throw new Error('Booking not found');

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'inr',
      description: `Service Booking #${bookingId}`,
      metadata: { booking_id: bookingId, customer_id: customerId },
    });

    await Payment.create({
      booking_id: bookingId,
      customer_id: customerId,
      provider_id: booking.provider_id,
      amount,
      currency: 'INR',
      stripe_payment_intent_id: paymentIntent.id,
      status: 'pending',
      payment_method: 'stripe',
    });

    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  }

  async confirmStripePayment(paymentIntentId) {
    const paymentIntent = await getStripe().paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') throw new Error('Payment not succeeded');

    const payment = await Payment.findOneAndUpdate(
      { stripe_payment_intent_id: paymentIntentId },
      {
        status: 'success',
        stripe_charge_id: paymentIntent.latest_charge,
        updated_at: new Date(),
      },
      { new: true }
    );

    await Booking.findByIdAndUpdate(payment.booking_id, { payment_status: 'paid' });
    return { success: true, payment };
  }

  // ─────────────────────────────────────────────
  //  WEBHOOKS
  // ─────────────────────────────────────────────

  async handleRazorpayWebhook(event, signature) {
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
    shasum.update(JSON.stringify(event));
    const digest = shasum.digest('hex');
    if (digest !== signature) throw new Error('Invalid webhook signature');

    switch (event.event) {
      case 'payment.failed':
        await Payment.findOneAndUpdate(
          { razorpay_payment_id: event.payload.payment.entity.id },
          { status: 'failed' }
        );
        break;
      case 'refund.created':
        await Payment.findOneAndUpdate(
          { refund_id: event.payload.refund.entity.id },
          { status: 'refunded' }
        );
        break;
    }

    return { success: true };
  }

  async getPaymentDetails(bookingId) {
    const payment = await Payment.findOne({ booking_id: bookingId });
    if (!payment) throw new Error('Payment not found');
    return payment;
  }
}

module.exports = new PaymentService();

================================================================================
FILE 17: src/socket/socketHandler.js
================================================================================

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

================================================================================
FILE 18: Dockerfile
================================================================================

FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["node", "src/app.js"]

================================================================================
FILE 19: .gitignore
================================================================================

node_modules/
.env
*.log

================================================================================
                            END OF BACKEND CODE
================================================================================
