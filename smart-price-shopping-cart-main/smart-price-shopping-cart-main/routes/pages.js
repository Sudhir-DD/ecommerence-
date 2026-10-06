const express = require('express');

const products = require('../models/products');
const cartModel = require('../models/cart');
const ordersModel = require('../models/orders');
const priceAlertsModel = require('../models/priceAlerts');
const insights = require('../services/insights');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const CATEGORY_CARDS = [
    { slug: 'mobiles', label: 'Mobiles', emoji: '', thumb: '/mobile.png' },
    { slug: 'watches', label: 'Watches', emoji: '', thumb: '/watches.png' },
    { slug: 'laptops', label: 'Laptops', emoji: '', thumb: '/laptop.png' },
    { slug: 'shoes', label: 'Shoes', emoji: '', thumb: '/shoes.png' },
    { slug: 'clothes', label: 'Clothes', emoji: '', thumb: '/clothes.png' },
    { slug: 'electronics', label: 'Electronics', emoji: '', thumb: '/electronics.png' }
];

const CATEGORY_META = Object.fromEntries(
    CATEGORY_CARDS.map((c) => [c.slug, c])
);

const SORT_OPTIONS = [
    { key: 'featured', label: 'Featured' },
    { key: 'price-asc', label: 'Price: low to high' },
    { key: 'price-desc', label: 'Price: high to low' },
    { key: 'drop', label: 'Biggest price drop (30d)' },
    { key: 'rating', label: 'Top rated' }
];

const SORTERS = {
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    drop: (a, b) => a.change30Pct - b.change30Pct,
    rating: (a, b) => (b.rating || 0) - (a.rating || 0)
};

function sortKey(value) {
    return SORT_OPTIONS.some((o) => o.key === value) ? value : 'featured';
}

function sortProducts(list, key) {
    return SORTERS[key] ? [...list].sort(SORTERS[key]) : list;
}

function withSummary(p) {
    return { ...p, ...insights.summary(p) };
}

router.get('/', (req, res) => {
    const all = products
        .findAll()
        .map((p) => ({ ...p, ...insights.summary(p), meta: CATEGORY_META[p.category] }));

    const drops = all
        .filter((p) => p.change30Pct <= -0.5)
        .sort((a, b) => a.change30Pct - b.change30Pct)
        .slice(0, 4);

    res.render('index', {
        categories: CATEGORY_CARDS,
        drops,
        // The biggest current drop headlines the hero; any product if none fell.
        spotlight: drops[0] || all[0],
        stats: {
            products: all.length,
            categories: CATEGORY_CARDS.length,
            dropping: all.filter((p) => p.change30Pct < 0).length
        }
    });
});

router.get('/product/:id', (req, res) => {
    const product = products.findById(Number(req.params.id));

    if (!product) {
        return res.status(404).render('404', { path: req.originalUrl });
    }

    res.render('product', { product, meta: CATEGORY_META[product.category] });
});

router.get('/category/:slug', (req, res) => {
    const { slug } = req.params;

    if (!products.isValidCategory(slug)) {
        return res.status(404).render('404', { path: req.originalUrl });
    }

    const sort = sortKey(req.query.sort);
    const items = sortProducts(products.findByCategory(slug).map(withSummary), sort);
    const meta = CATEGORY_META[slug];
    const nextSlug = products.nextCategory(slug);

    res.render('category', {
        slug,
        meta,
        products: items,
        nextSlug,
        nextMeta: CATEGORY_META[nextSlug],
        sort,
        sortOptions: SORT_OPTIONS
    });
});

router.get('/search', (req, res) => {
    const query = String(req.query.q || '').trim().slice(0, 100);
    const sort = sortKey(req.query.sort);
    const results = sortProducts(products.search(query).map(withSummary), sort);

    res.render('search', {
        searchQuery: query,
        products: results,
        categories: CATEGORY_CARDS,
        sort,
        sortOptions: SORT_OPTIONS
    });
});

router.get('/login', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    res.render('login', { next: safeNextPath(req.query.next) });
});

// Only allow same-site paths, so /login?next=https://evil.example (or
// //evil.example) can't bounce a freshly logged-in user off-site.
function safeNextPath(next) {
    if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
        return '/';
    }

    return next;
}

router.get('/signup', (req, res) => {
    if (req.user) {
        return res.redirect('/');
    }

    res.render('signup');
});

router.get('/cart', requireAuth, (req, res) => {
    const items = cartModel.getItems(req.user.id);
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.render('cart', { items, total });
});

router.get('/orders', requireAuth, (req, res) => {
    const orders = ordersModel.getOrdersForUser(req.user.id);

    res.render('orders', { orders });
});

router.get('/price-alerts', requireAuth, (req, res) => {
    const alerts = insights.withEta(priceAlertsModel.listForUser(req.user.id));
    const newlyReachedCount = priceAlertsModel.countUnseen(req.user.id);

    priceAlertsModel.acknowledgeReached(req.user.id);

    res.render('price-alerts', { alerts, newlyReachedCount });
});

module.exports = router;
