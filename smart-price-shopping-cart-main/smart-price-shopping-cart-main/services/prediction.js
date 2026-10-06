/**
 * Price prediction: damped Holt (double exponential smoothing) trend
 * forecasting over a product's daily price series. Smoothing parameters are
 * picked per product by grid search on one-step-ahead error, and the
 * prediction band comes from that same error, so noisy products get wider
 * ranges. These are statistical estimates, not guarantees.
 */

const PHI = 0.97;
const ALPHAS = [0.2, 0.3, 0.4, 0.5, 0.6];
const BETAS = [0.05, 0.1, 0.2];
const MAX_ETA_DAYS = 90;

function holtFit(y, alpha, beta) {
    const n = y.length;
    const seedSpan = Math.min(n - 1, 6);

    let level = y[0];
    let trend = seedSpan > 0 ? (y[seedSpan] - y[0]) / seedSpan : 0;
    let sse = 0;
    const errors = [];

    for (let t = 1; t < n; t++) {
        const predicted = level + PHI * trend;
        const error = y[t] - predicted;
        const previousLevel = level;

        errors.push(error);
        sse += error * error;

        level = alpha * y[t] + (1 - alpha) * predicted;
        trend = beta * (level - previousLevel) + (1 - beta) * PHI * trend;
    }

    return { level, trend, sse, errors };
}

function bestFit(y) {
    let best = null;

    for (const alpha of ALPHAS) {
        for (const beta of BETAS) {
            const fit = holtFit(y, alpha, beta);

            if (!best || fit.sse < best.sse) {
                best = { ...fit, alpha, beta };
            }
        }
    }

    return best;
}

function normalCdf(x) {
    // Abramowitz & Stegun 7.1.26 approximation of erf.
    const sign = x < 0 ? -1 : 1;
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const poly =
        ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - poly * Math.exp(-z * z);

    return 0.5 * (1 + sign * erf);
}

function windowText(optimisticDays, expectedDays) {
    if (expectedDays !== null) {
        const from = Math.max(1, Math.ceil(optimisticDays / 7));
        const to = Math.max(1, Math.ceil(expectedDays / 7));

        if (expectedDays <= 7) return 'within a week';
        if (from === to) return `in about ${to} week${to > 1 ? 's' : ''}`;
        return `in ${from}-${to} weeks`;
    }

    if (optimisticDays !== null) {
        const weeks = Math.max(1, Math.ceil(optimisticDays / 7));
        return `possible in ~${weeks} week${weeks > 1 ? 's' : ''}, but not the most likely path`;
    }

    return 'unlikely within the next 3 months at the current trend';
}

/**
 * @param {number[]} prices daily prices, oldest first
 * @param {{target?: number|null, horizon?: number}} options
 */
function predict(prices, { target = null, horizon = 42 } = {}) {
    const n = prices.length;

    if (n < 3) {
        return null;
    }

    const fit = bestFit(prices);
    const recentErrors = fit.errors.slice(-60);
    const sigma = Math.sqrt(recentErrors.reduce((s, e) => s + e * e, 0) / recentErrors.length);
    const current = prices[n - 1];

    function at(h) {
        const dampedSum = (PHI * (1 - Math.pow(PHI, h))) / (1 - PHI);
        const mean = fit.level + fit.trend * dampedSum;
        const sd = Math.min(sigma * Math.sqrt(h), 0.35 * fit.level);

        return { mean, sd };
    }

    const points = [];

    for (let h = 1; h <= horizon; h++) {
        const { mean, sd } = at(h);

        points.push({
            day: h,
            price: Math.round(Math.max(mean, 0)),
            low: Math.round(Math.max(mean - 1.96 * sd, 0)),
            high: Math.round(mean + 1.96 * sd)
        });
    }

    const trendPctPerWeek = ((fit.trend * 7) / fit.level) * 100;
    const direction = trendPctPerWeek <= -0.7 ? 'falling' : trendPctPerWeek >= 0.7 ? 'rising' : 'stable';

    const noise = sigma / fit.level;
    let confidence = noise < 0.012 ? 'high' : noise < 0.03 ? 'medium' : 'low';

    if (n < 14) {
        confidence = 'low';
    }

    const result = {
        model: 'Damped Holt trend forecast',
        dataPoints: n,
        current,
        trendPerDay: fit.trend,
        trendPctPerWeek,
        direction,
        confidence,
        points,
        checkpoints: {
            week1: points[6],
            week2: points[13],
            week3: points[20],
            week4: points[27]
        },
        target: null
    };

    if (target !== null) {
        result.target = describeTarget(target, current, at);
    }

    return result;
}

function describeTarget(target, current, at) {
    if (current <= target) {
        return {
            price: target,
            reached: true,
            expectedDays: 0,
            optimisticDays: 0,
            window: 'already reached',
            chance4w: 1
        };
    }

    let expectedDays = null;
    let optimisticDays = null;

    for (let h = 1; h <= MAX_ETA_DAYS; h++) {
        const { mean, sd } = at(h);

        if (optimisticDays === null && mean - sd <= target) {
            optimisticDays = h;
        }

        if (expectedDays === null && mean <= target) {
            expectedDays = h;
        }

        if (expectedDays !== null) {
            break;
        }
    }

    let chance4w = 0;

    for (let h = 1; h <= 28; h++) {
        const { mean, sd } = at(h);
        chance4w = Math.max(chance4w, sd > 0 ? normalCdf((target - mean) / sd) : mean <= target ? 1 : 0);
    }

    return {
        price: target,
        reached: false,
        expectedDays,
        optimisticDays,
        window: windowText(optimisticDays, expectedDays),
        chance4w
    };
}

module.exports = { predict };
