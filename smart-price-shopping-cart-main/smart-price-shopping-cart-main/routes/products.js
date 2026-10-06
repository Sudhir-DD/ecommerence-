const express = require('express');

const products = require('../models/products');
const priceAlerts = require('../models/priceAlerts');
const insights = require('../services/insights');

const router = express.Router();

const RANGES = [7, 30, 90];

// Price history + stats + AI prediction for one product. `target` may be
// passed to preview "when would it reach this price" without saving an alert.
router.get('/:id/insights', (req, res) => {
    const product = products.findById(Number(req.params.id));

    if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
    }

    const days = RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 90;
    const alert = req.user ? priceAlerts.findForUserProduct(req.user.id, product.id) : null;

    let target = alert ? alert.target_price : null;

    if (req.query.target !== undefined) {
        const requested = Number(req.query.target);
        target = Number.isFinite(requested) && requested > 0 ? requested : target;
    }

    res.json({
        product: {
            id: product.id,
            name: product.name,
            price: product.price
        },
        loggedIn: Boolean(req.user),
        alert,
        ...insights.build(product, { days, target })
    });
});

module.exports = router;
