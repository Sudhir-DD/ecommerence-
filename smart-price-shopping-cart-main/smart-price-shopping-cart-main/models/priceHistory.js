const db = require('../db/database');

function record(productId, price, recordedAt) {
    if (recordedAt) {
        db.prepare('INSERT INTO price_history (product_id, price, recorded_at) VALUES (?, ?, ?)').run(
            productId,
            price,
            recordedAt
        );
        return;
    }

    db.prepare('INSERT INTO price_history (product_id, price) VALUES (?, ?)').run(productId, price);
}

function hasHistory(productId) {
    const row = db.prepare('SELECT COUNT(*) AS count FROM price_history WHERE product_id = ?').get(productId);
    return row.count > 0;
}

// One point per calendar day (UTC): the last price recorded that day.
function dailySeries(productId, days) {
    return db
        .prepare(
            `SELECT substr(recorded_at, 1, 10) AS date, price
             FROM price_history
             WHERE id IN (
                 SELECT MAX(id) FROM price_history
                 WHERE product_id = ? AND recorded_at >= datetime('now', ?)
                 GROUP BY substr(recorded_at, 1, 10)
             )
             ORDER BY date ASC`
        )
        .all(productId, `-${days} days`);
}

// Keeps the table small: once a day is over, only its final price is kept.
function compactOld() {
    db.prepare(
        `DELETE FROM price_history
         WHERE recorded_at < datetime('now', '-2 days')
           AND id NOT IN (
               SELECT MAX(id) FROM price_history
               GROUP BY product_id, substr(recorded_at, 1, 10)
           )`
    ).run();
}

module.exports = { record, hasHistory, dailySeries, compactOld };
