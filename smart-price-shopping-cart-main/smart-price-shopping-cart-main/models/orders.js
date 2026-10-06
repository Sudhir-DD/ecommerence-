const db = require('../db/database');
const cart = require('./cart');
const products = require('./products');

class EmptyCartError extends Error {}
class ProductNotFoundError extends Error {}

function createOrder(userId, items) {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    db.exec('BEGIN');

    try {
        const orderResult = db
            .prepare('INSERT INTO orders (user_id, total) VALUES (?, ?)')
            .run(userId, total);

        const orderId = Number(orderResult.lastInsertRowid);

        const insertItem = db.prepare(
            'INSERT INTO order_items (order_id, product_id, name, price, image, quantity) VALUES (?, ?, ?, ?, ?, ?)'
        );

        for (const item of items) {
            insertItem.run(orderId, item.product_id, item.name, item.price, item.image, item.quantity);
        }

        db.exec('COMMIT');

        return orderId;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

function checkout(userId) {
    const items = cart.getItems(userId);

    if (items.length === 0) {
        throw new EmptyCartError('Cart is empty');
    }

    const orderId = createOrder(userId, items);

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

    return orderId;
}

function buyNow(userId, productId, quantity = 1) {
    const product = products.findById(productId);

    if (!product) {
        throw new ProductNotFoundError('Product not found');
    }

    const item = {
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity
    };

    return createOrder(userId, [item]);
}

function getOrdersForUser(userId) {
    const orders = db
        .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC')
        .all(userId);

    const itemsStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ?');

    return orders.map((order) => ({
        ...order,
        items: itemsStmt.all(order.id)
    }));
}

module.exports = {
    checkout,
    buyNow,
    getOrdersForUser,
    EmptyCartError,
    ProductNotFoundError
};
