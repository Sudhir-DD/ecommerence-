const crypto = require('crypto');
const db = require('../db/database');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function create(userId) {
    const id = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)').run(
        id,
        userId,
        expiresAt
    );

    return { id, expiresAt };
}

function findValid(id) {
    if (!id) {
        return null;
    }

    const session = db
        // expires_at is an ISO string (2026-01-01T00:00:00.000Z), so compare
        // against 'now' in the same format; datetime('now') uses a space
        // instead of 'T' and would sort every same-day expiry as still valid.
        .prepare("SELECT * FROM sessions WHERE id = ? AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
        .get(id);

    return session || null;
}

function destroy(id) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
}

module.exports = {
    create,
    findValid,
    destroy,
    SESSION_TTL_MS
};
