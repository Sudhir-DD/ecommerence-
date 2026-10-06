const priceHistory = require('../models/priceHistory');
const { predict } = require('./prediction');
const { roundPrice } = require('./priceUtils');

const HISTORY_FETCH_DAYS = 120;
const FORECAST_HORIZON = 42;

function todayUtc() {
    return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// Daily series whose final point is always the product's live price.
function dailyPrices(product) {
    const daily = priceHistory.dailySeries(product.id, HISTORY_FETCH_DAYS);
    const today = todayUtc();
    const last = daily[daily.length - 1];

    if (!last || last.date !== today) {
        daily.push({ date: today, price: product.price });
    } else {
        last.price = product.price;
    }

    return daily;
}

function pctChange(from, to) {
    return from ? ((to - from) / from) * 100 : 0;
}

function verdictFor(current, stats, prediction) {
    const in2w = prediction.checkpoints.week2.price;
    const expectedChange = pctChange(current, in2w);

    if (stats.vsLowPct <= 3) {
        return { level: 'buy', message: 'Near its lowest price in the last 90 days - a good time to buy.' };
    }

    if (expectedChange <= -2) {
        return {
            level: 'wait',
            message: `Likely to drop about ${Math.abs(expectedChange).toFixed(1)}% in 2 weeks - consider waiting or setting an alert.`
        };
    }

    if (expectedChange >= 2) {
        return { level: 'buy', message: 'The price is trending up - buying sooner may save money.' };
    }

    return { level: 'fair', message: 'The price is fairly stable right now.' };
}

function build(product, { days = 90, target = null } = {}) {
    const daily = dailyPrices(product);
    const prices = daily.map((d) => d.price);
    const today = daily[daily.length - 1].date;
    const current = product.price;

    const prediction = predict(prices, { target, horizon: FORECAST_HORIZON });

    if (prediction) {
        prediction.points = prediction.points.map((p) => ({ ...p, date: addDays(today, p.day) }));
        prediction.checkpoints = Object.fromEntries(
            Object.entries(prediction.checkpoints).map(([key, p]) => [key, { ...p, date: addDays(today, p.day) }])
        );
    }

    const window = daily.slice(-days);
    const windowPrices = window.map((d) => d.price);
    const min = Math.min(...windowPrices);
    const max = Math.max(...windowPrices);
    const minPoint = window.find((d) => d.price === min);
    const maxPoint = window.find((d) => d.price === max);
    const avg = Math.round(windowPrices.reduce((s, p) => s + p, 0) / windowPrices.length);
    const thirtyAgo = daily[Math.max(0, daily.length - 31)].price;

    const stats = {
        current,
        min,
        max,
        minDate: minPoint.date,
        maxDate: maxPoint.date,
        avg,
        changePct: pctChange(windowPrices[0], current),
        change30Pct: pctChange(thirtyAgo, current),
        vsLowPct: pctChange(min, current),
        vsHighPct: pctChange(max, current)
    };

    let verdict = null;
    let suggestedTarget = null;

    if (prediction) {
        verdict = verdictFor(current, stats, prediction);

        const candidate = Math.min(current * 0.95, prediction.checkpoints.week3.price);
        suggestedTarget = roundPrice(Math.max(candidate, min));

        if (suggestedTarget >= current) {
            suggestedTarget = roundPrice(current * 0.95);
        }
    }

    return { history: window, stats, prediction, verdict, suggestedTarget };
}

// Compact data for cards: a sparkline plus the 30-day change.
function summary(product) {
    const daily = dailyPrices(product).slice(-30);
    const prices = daily.map((d) => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const width = 120;
    const height = 36;
    const pad = 3;
    const span = max - min || 1;

    const points = prices
        .map((price, i) => {
            const x = pad + (i / Math.max(prices.length - 1, 1)) * (width - pad * 2);
            const y = height - pad - ((price - min) / span) * (height - pad * 2);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');

    return {
        spark: points,
        change30Pct: pctChange(prices[0], product.price)
    };
}

// Short "when will it hit my target" text for a saved alert.
function etaFor(product, target) {
    const prediction = predict(dailyPrices(product).map((d) => d.price), { target, horizon: FORECAST_HORIZON });

    return prediction && prediction.target ? prediction.target : null;
}

function withEta(alerts) {
    return alerts.map((alert) => ({
        ...alert,
        eta: alert.reached
            ? null
            : etaFor({ id: alert.product_id, price: alert.current_price }, alert.target_price)
    }));
}

module.exports = { build, summary, etaFor, withEta };
