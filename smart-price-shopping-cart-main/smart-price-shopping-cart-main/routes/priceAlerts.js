const express = require('express');

const priceAlerts = require('../models/priceAlerts');
const products = require('../models/products');
const insights = require('../services/insights');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

function alertsFor(userId) {
    return insights.withEta(priceAlerts.listForUser(userId));
}

router.get('/', (req, res) => {
    res.json({ alerts: alertsFor(req.user.id) });
});

router.get('/count', (req, res) => {
    res.json({ count: priceAlerts.countUnseen(req.user.id) });
});

router.post('/', (req, res) => {
    const productId = Number(req.body.productId);
    const targetPrice = Number(req.body.targetPrice);

    if (!productId || !Number.isFinite(targetPrice) || targetPrice <= 0) {
        return res.status(400).json({ error: 'A valid productId and targetPrice are required.' });
    }

    const product = products.findById(productId);

    if (!product) {
        return res.status(404).json({ error: 'Product not found.' });
    }

    priceAlerts.upsert(req.user.id, productId, targetPrice);

    res.status(201).json({ alerts: alertsFor(req.user.id) });
});

router.delete('/:id', (req, res) => {
    const alertId = Number(req.params.id);

    if (!priceAlerts.findOwned(req.user.id, alertId)) {
        return res.status(404).json({ error: 'Alert not found.' });
    }

    priceAlerts.remove(req.user.id, alertId);

    res.json({ alerts: alertsFor(req.user.id) });
});

module.exports = router;
