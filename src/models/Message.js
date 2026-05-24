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
