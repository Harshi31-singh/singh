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
