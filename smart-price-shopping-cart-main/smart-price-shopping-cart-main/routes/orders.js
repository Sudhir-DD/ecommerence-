const express = require('express');

const orders = require('../models/orders');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/checkout', requireAuth, (req, res) => {
    try {
        const orderId = orders.checkout(req.user.id);
        res.status(201).json({ orderId });
    } catch (err) {
        if (err instanceof orders.EmptyCartError) {
            return res.status(400).json({ error: 'Your cart is empty.' });
        }

        throw err;
    }
});

router.post('/buy-now', requireAuth, (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'A valid productId and a whole-number quantity are required.' });
    }

    try {
        const orderId = orders.buyNow(req.user.id, productId, quantity);
        res.status(201).json({ orderId });
    } catch (err) {
        if (err instanceof orders.ProductNotFoundError) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        throw err;
    }
});

module.exports = router;
