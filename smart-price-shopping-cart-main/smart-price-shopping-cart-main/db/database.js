const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// DB_PATH lets tests or a second instance use their own database file.
const dbPath = process.env.DB_PATH || path.join(__dirname, 'shop.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// CREATE TABLE IF NOT EXISTS won't add columns to a table that already
// exists from an older schema version, so patch it in for existing DBs.
const priceAlertColumns = db.prepare('PRAGMA table_info(price_alerts)').all();
if (!priceAlertColumns.some((c) => c.name === 'acknowledged_at')) {
    db.exec('ALTER TABLE price_alerts ADD COLUMN acknowledged_at TEXT');
}

module.exports = db;
