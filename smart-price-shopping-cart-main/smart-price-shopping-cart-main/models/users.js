const db = require('../db/database');

function findByUsername(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findByMobile(mobile) {
    return db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
}

function findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function create({ name, username, email, mobile }) {
    const result = db
        .prepare('INSERT INTO users (name, username, email, mobile) VALUES (?, ?, ?, ?)')
        .run(name, username, email, mobile);

    return findById(Number(result.lastInsertRowid));
}

module.exports = {
    findByUsername,
    findByEmail,
    findByMobile,
    findById,
    create
};
