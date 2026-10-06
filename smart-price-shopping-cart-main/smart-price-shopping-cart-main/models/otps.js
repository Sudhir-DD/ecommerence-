const db = require('../db/database');

const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function create(mobile, purpose, payload = null) {
    const otpCode = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    db.prepare(
        'INSERT INTO otps (mobile, purpose, otp_code, payload, expires_at) VALUES (?, ?, ?, ?, ?)'
    ).run(mobile, purpose, otpCode, payload ? JSON.stringify(payload) : null, expiresAt);

    return { otpCode, expiresAt };
}

function findValid(mobile, purpose, otpCode) {
    const row = db
        .prepare(
            `SELECT * FROM otps
             WHERE mobile = ? AND purpose = ? AND otp_code = ? AND used = 0 AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             ORDER BY id DESC LIMIT 1`
        )
        .get(mobile, purpose, otpCode);

    if (!row) {
        return null;
    }

    return { ...row, payload: row.payload ? JSON.parse(row.payload) : null };
}

function markUsed(id) {
    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(id);
}

module.exports = {
    create,
    findValid,
    markUsed
};
