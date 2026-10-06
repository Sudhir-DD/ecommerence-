/**
 * There is no real price feed behind this demo store, so this simulates one:
 * every tick each product's price takes a small random step, gently pulled
 * back toward its recent average, with the occasional sale-style jump. Each
 * change is written to price_history via products.setPrice.
 *
 *   PRICE_SIMULATOR=off       disable it (prices then only change if you
 *                             update them yourself with products.setPrice)
 *   PRICE_TICK_SECONDS=60     how often prices update (default 60)
 */

const products = require('../models/products');
const priceHistory = require('../models/priceHistory');
const { gauss, roundPrice } = require('./priceUtils');

const NOISE = 0.0006;
const REVERSION = 0.002;
const JUMP_CHANCE = 1 / 150;
const MAX_DEVIATION = 0.3;

function start({ onChange } = {}) {
    if (String(process.env.PRICE_SIMULATOR || '').toLowerCase() === 'off') {
        console.log('Price simulator is off (PRICE_SIMULATOR=off).');
        return null;
    }

    const tickSeconds = Math.max(5, Number(process.env.PRICE_TICK_SECONDS) || 60);

    const baselines = new Map();

    for (const product of products.findAll()) {
        const series = priceHistory.dailySeries(product.id, 90);
        const avg = series.length ? series.reduce((s, d) => s + d.price, 0) / series.length : product.price;
        baselines.set(product.id, avg);
    }

    function tick() {
        let changed = 0;

        for (const product of products.findAll()) {
            const base = baselines.get(product.id) || product.price;
            const reversion = -REVERSION * Math.log(product.price / base);
            const jump =
                Math.random() < JUMP_CHANCE ? (Math.random() < 0.6 ? -1 : 1) * (0.02 + Math.random() * 0.05) : 0;

            let next = product.price * Math.exp(gauss(Math.random) * NOISE + reversion + jump);
            next = Math.min(Math.max(next, base * (1 - MAX_DEVIATION)), base * (1 + MAX_DEVIATION));
            next = roundPrice(next);

            if (next !== product.price) {
                products.setPrice(product.id, next);
                changed++;
            }
        }

        if (changed > 0 && onChange) {
            onChange();
        }
    }

    const priceTimer = setInterval(tick, tickSeconds * 1000);
    const compactTimer = setInterval(() => priceHistory.compactOld(), 6 * 60 * 60 * 1000);

    priceHistory.compactOld();
    console.log(`Price simulator running: prices update every ${tickSeconds}s.`);

    return { priceTimer, compactTimer };
}

module.exports = { start };
