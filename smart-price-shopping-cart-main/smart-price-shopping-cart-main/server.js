const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

require('./db/database');
require('./db/seed')();

const { attachUser, requireAuth } = require('./middleware/auth');

const pagesRouter = require('./routes/pages');
const authRouter = require('./routes/auth');
const cartRouter = require('./routes/cart');
const ordersRouter = require('./routes/orders');
const priceAlertsRouter = require('./routes/priceAlerts');
const productsRouter = require('./routes/products');

const priceAlerts = require('./models/priceAlerts');
const sms = require('./services/sms');
const priceSimulator = require('./services/priceSimulator');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Only the logo and category thumbnails live in the project root. Serving the
// whole folder statically would expose db/shop.db (users + live session ids),
// server code and config, so whitelist exactly these files.
const ROOT_IMAGES = new Set([
    'logo.png', 'mobile.png', 'watches.png', 'laptop.png', 'shoes.png', 'clothes.png', 'electronics.png'
]);

app.get('/:file', (req, res, next) => {
    if (!ROOT_IMAGES.has(req.params.file)) {
        return next();
    }

    res.sendFile(path.join(__dirname, req.params.file));
});

app.use(attachUser);

// The whole store is behind login: anyone not signed in lands on /login
// (and is sent back to the page they wanted afterwards).
const PUBLIC_PAGES = new Set(['/login', '/signup']);

app.use((req, res, next) => {
    if (req.user || PUBLIC_PAGES.has(req.path) || req.path.startsWith('/api/auth/')) {
        return next();
    }

    requireAuth(req, res, next);
});

app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api/price-alerts', priceAlertsRouter);
app.use('/api/products', productsRouter);
app.use('/api', ordersRouter);
app.use('/', pagesRouter);

app.use((req, res) => {
    res.status(404).render('404', { path: req.originalUrl });
});

app.use((err, req, res, next) => {
    // express.json() rejects malformed bodies with a 400; keep that status.
    const status = err.status && err.status < 500 ? err.status : 500;

    if (status === 500) {
        console.error(err);
    }

    const message = status === 500 ? 'Something went wrong.' : 'Invalid request.';

    if (req.originalUrl.startsWith('/api/')) {
        return res.status(status).json({ error: message });
    }

    // Styled error page; fall back to plain text if the page itself fails.
    res.status(status).render('error', { status, user: req.user || null }, (renderErr, html) => {
        if (renderErr) {
            console.error(renderErr);
            return res.send(message);
        }

        res.send(html);
    });
});

async function checkPriceAlerts() {
    const due = priceAlerts.findDueForNotification();

    for (const alert of due) {
        await sms.sendPriceAlert(alert.mobile, alert.name, alert.current_price);
        priceAlerts.markNotified(alert.id);
    }
}

const PRICE_ALERT_CHECK_INTERVAL_MS = 60 * 1000;
setInterval(() => {
    checkPriceAlerts().catch((err) => console.error('Price alert check failed:', err));
}, PRICE_ALERT_CHECK_INTERVAL_MS);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Shopping cart app listening on http://localhost:${PORT}`);
    checkPriceAlerts().catch((err) => console.error('Price alert check failed:', err));

    priceSimulator.start({
        onChange: () => checkPriceAlerts().catch((err) => console.error('Price alert check failed:', err))
    });
});
