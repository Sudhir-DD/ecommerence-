const db = require('../db/database');

function listForUser(userId) {
    const rows = db
        .prepare(
            `SELECT pa.id AS id, pa.target_price AS target_price, pa.notified_at AS notified_at,
                    pa.acknowledged_at AS acknowledged_at, pa.created_at AS created_at,
                    p.id AS product_id, p.name AS name, p.image AS image, p.price AS current_price
             FROM price_alerts pa
             JOIN products p ON p.id = pa.product_id
             WHERE pa.user_id = ?
             ORDER BY pa.created_at DESC`
        )
        .all(userId);

    return rows.map((row) => ({ ...row, reached: row.current_price <= row.target_price }));
}

// Reached alerts the user hasn't seen yet (drives the header badge/toast).
function countUnseen(userId) {
    const row = db
        .prepare(
            `SELECT COUNT(*) AS count
             FROM price_alerts pa
             JOIN products p ON p.id = pa.product_id
             WHERE pa.user_id = ? AND pa.acknowledged_at IS NULL AND p.price <= pa.target_price`
        )
        .get(userId);

    return row.count;
}

// Marks every currently-reached alert as seen, e.g. once the user opens the
// alerts page. Alerts that haven't hit their target yet are left untouched
// so they still show up unseen the moment they do reach it.
function acknowledgeReached(userId) {
    db.prepare(
        `UPDATE price_alerts
         SET acknowledged_at = datetime('now')
         WHERE user_id = ? AND acknowledged_at IS NULL
           AND id IN (
               SELECT pa.id FROM price_alerts pa
               JOIN products p ON p.id = pa.product_id
               WHERE pa.user_id = ? AND p.price <= pa.target_price
           )`
    ).run(userId, userId);
}

function findForUserProduct(userId, productId) {
    return listForUser(userId).find((alert) => alert.product_id === productId) || null;
}

function findOwned(userId, alertId) {
    return db.prepare('SELECT * FROM price_alerts WHERE id = ? AND user_id = ?').get(alertId, userId);
}

function upsert(userId, productId, targetPrice) {
    db.prepare(
        `INSERT INTO price_alerts (user_id, product_id, target_price)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, product_id) DO UPDATE SET
            target_price = excluded.target_price,
            notified_at = NULL,
            acknowledged_at = NULL`
    ).run(userId, productId, targetPrice);
}

function remove(userId, alertId) {
    db.prepare('DELETE FROM price_alerts WHERE id = ? AND user_id = ?').run(alertId, userId);
}

function findDueForNotification() {
    return db
        .prepare(
            `SELECT pa.id AS id, p.name AS name, p.price AS current_price, u.mobile AS mobile
             FROM price_alerts pa
             JOIN products p ON p.id = pa.product_id
             JOIN users u ON u.id = pa.user_id
             WHERE pa.notified_at IS NULL AND p.price <= pa.target_price`
        )
        .all();
}

function markNotified(alertId) {
    db.prepare("UPDATE price_alerts SET notified_at = datetime('now') WHERE id = ?").run(alertId);
}

module.exports = {
    listForUser,
    countUnseen,
    acknowledgeReached,
    findForUserProduct,
    findOwned,
    upsert,
    remove,
    findDueForNotification,
    markNotified
};
