const db = require('../db/database');
const priceHistory = require('./priceHistory');

const CATEGORIES = ['mobiles', 'watches', 'laptops', 'shoes', 'clothes', 'electronics'];

function isValidCategory(slug) {
    return CATEGORIES.includes(slug);
}

function nextCategory(slug) {
    const index = CATEGORIES.indexOf(slug);
    return CATEGORIES[(index + 1) % CATEGORIES.length];
}

function findByCategory(category) {
    return db
        .prepare('SELECT * FROM products WHERE category = ? ORDER BY sort_order ASC')
        .all(category);
}

function findAll() {
    return db.prepare('SELECT * FROM products ORDER BY id ASC').all();
}

// Words people search with that don't appear in product names, mapped to the
// category they mean ("phone" -> mobiles, "sneakers" -> shoes, ...).
const CATEGORY_KEYWORDS = {
    mobiles: ['mobile', 'phone', 'smartphone', 'android'],
    watches: ['watch', 'luxury', 'wrist'],
    laptops: ['laptop', 'notebook', 'computer', 'pc'],
    shoes: ['shoe', 'sneaker', 'footwear', 'running'],
    clothes: ['cloth', 'clothes', 'wear', 'apparel', 'fashion', 'shirt'],
    electronics: ['electronic', 'gadget', 'audio', 'bluetooth', 'wireless']
};

// Every word must match the product's name, description or category
// (directly or via CATEGORY_KEYWORDS), so "black shoes" narrows results.
function search(query) {
    const words = String(query || '')
        .toLowerCase()
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z0-9]/g, ''))
        .filter(Boolean);

    if (words.length === 0) {
        return [];
    }

    return findAll().filter((p) => {
        // Match from the start of a word, so "phone" doesn't hit "headphones".
        const tokens = `${p.name} ${p.description} ${p.category}`.toLowerCase().split(/[^a-z0-9]+/);
        const aliases = CATEGORY_KEYWORDS[p.category];

        return words.every(
            (w) =>
                tokens.some((t) => t.startsWith(w)) ||
                aliases.some((a) => (w.length >= 3 && a.startsWith(w)) || w.startsWith(a))
        );
    });
}

function findById(id) {
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

// Changing a price always goes through here so the history stays complete.
function setPrice(id, price) {
    db.exec('BEGIN');

    try {
        db.prepare('UPDATE products SET price = ? WHERE id = ?').run(price, id);
        priceHistory.record(id, price);
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

module.exports = {
    CATEGORIES,
    isValidCategory,
    nextCategory,
    findByCategory,
    findAll,
    search,
    findById,
    setPrice
};
