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
