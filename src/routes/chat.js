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
