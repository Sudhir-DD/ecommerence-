const db = require('../db/database');

function getItems(userId) {
    return db
        .prepare(
            `SELECT ci.id AS id, ci.quantity AS quantity,
                    p.id AS product_id, p.name AS name, p.price AS price, p.image AS image
             FROM cart_items ci
             JOIN products p ON p.id = ci.product_id
             WHERE ci.user_id = ?
             ORDER BY ci.created_at ASC`
        )
        .all(userId);
}

function getCount(userId) {
    const row = db
        .prepare('SELECT COALESCE(SUM(quantity), 0) AS count FROM cart_items WHERE user_id = ?')
        .get(userId);

    return row.count;
}

function addItem(userId, productId, quantity = 1) {
    db.prepare(
        `INSERT INTO cart_items (user_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity`
    ).run(userId, productId, quantity);
}

function findOwnedItem(userId, itemId) {
    return db
        .prepare('SELECT * FROM cart_items WHERE id = ? AND user_id = ?')
        .get(itemId, userId);
}

function updateQuantity(userId, itemId, quantity) {
    if (quantity <= 0) {
        return removeItem(userId, itemId);
    }

    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?').run(
        quantity,
        itemId,
        userId
    );
}

function removeItem(userId, itemId) {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(itemId, userId);
}

function clear(userId) {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
}

module.exports = {
    getItems,
    getCount,
    addItem,
    findOwnedItem,
    updateQuantity,
    removeItem,
    clear
};
