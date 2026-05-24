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
