// Small deterministic RNG so seeded price history is the same on every install.
function mulberry32(seed) {
    let a = seed >>> 0;

    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Standard normal sample (Box-Muller).
function gauss(rand) {
    const u = Math.max(rand(), 1e-9);
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// Prices move in believable increments: ₹1 for cheap items, ₹10 / ₹100 for
// expensive ones.
function priceStep(price) {
    if (price >= 100000) return 100;
    if (price >= 10000) return 10;
    return 1;
}

function roundPrice(price) {
    const step = priceStep(price);
    return Math.max(step, Math.round(price / step) * step);
}

module.exports = { mulberry32, gauss, priceStep, roundPrice };
