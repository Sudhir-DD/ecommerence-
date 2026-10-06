const express = require('express');

const cart = require('../models/cart');
const products = require('../models/products');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function serializeCart(userId) {
    const items = cart.getItems(userId);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    return { items, total };
}

router.get('/', (req, res) => {
    res.json(serializeCart(req.user.id));
});

router.get('/count', (req, res) => {
    res.json({ count: cart.getCount(req.user.id) });
});

router.post('/', (req, res) => {
    const productId = Number(req.body.productId);
    const quantity = req.body.quantity === undefined ? 1 : Number(req.body.quantity);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'A valid productId and a whole-number quantity are required.' });
    }

    const product = products.findById(productId);

    if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
    }

    cart.addItem(req.user.id, productId, quantity);

    res.status(201).json(serializeCart(req.user.id));
});

router.patch('/:itemId', (req, res) => {
    const itemId = Number(req.params.itemId);
    const quantity = Number(req.body.quantity);

    if (!cart.findOwnedItem(req.user.id, itemId)) {
        return res.status(404).json({ error: 'Cart item not found.' });
    }

    if (!Number.isInteger(quantity)) {
        return res.status(400).json({ error: 'A valid quantity is required.' });
    }

    cart.updateQuantity(req.user.id, itemId, quantity);

    res.json(serializeCart(req.user.id));
});

router.delete('/:itemId', (req, res) => {
    const itemId = Number(req.params.itemId);

    if (!cart.findOwnedItem(req.user.id, itemId)) {
        return res.status(404).json({ error: 'Cart item not found.' });
    }

    cart.removeItem(req.user.id, itemId);

    res.json(serializeCart(req.user.id));
});

module.exports = router;
