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
