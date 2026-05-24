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
