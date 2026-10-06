const express = require('express');

const users = require('../models/users');
const sessions = require('../models/sessions');
const otps = require('../models/otps');
const sms = require('../services/sms');

const router = express.Router();

const MOBILE_PATTERN = /^[0-9]{10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOKIE_OPTIONS = {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: sessions.SESSION_TTL_MS
};

function setSessionCookie(res, userId) {
    const session = sessions.create(userId);
    res.cookie('sid', session.id, COOKIE_OPTIONS);
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        mobile: user.mobile
    };
}

function otpResponse(base, otpCode) {
    return sms.STUB_MODE ? { ...base, demoOtp: otpCode } : base;
}

router.post('/signup/request-otp', async (req, res) => {
    const name = String(req.body.name ?? '').trim();
    const username = String(req.body.username ?? '').trim();
    const email = String(req.body.email ?? '').trim().toLowerCase();
    const mobile = String(req.body.mobile ?? '').trim();

    if (!name || !username || !email || !mobile) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    if (!MOBILE_PATTERN.test(mobile)) {
        return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    }

    if (!EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (users.findByUsername(username)) {
        return res.status(409).json({ error: 'That username is already taken.' });
    }

    if (users.findByEmail(email)) {
        return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    if (users.findByMobile(mobile)) {
        return res.status(409).json({ error: 'An account with that mobile number already exists. Try logging in instead.' });
    }

    const { otpCode, expiresAt } = otps.create(mobile, 'signup', { name, username, email, mobile });

    try {
        await sms.sendOtp(mobile, otpCode);
    } catch (err) {
        return res.status(502).json({ error: 'Could not send SMS: ' + err.message });
    }

    res.json(otpResponse({ message: 'OTP sent to your mobile number.', expiresAt }, otpCode));
});

router.post('/signup/verify-otp', (req, res) => {
    const mobile = String(req.body.mobile ?? '').trim();
    const otp = String(req.body.otp ?? '').trim();

    const record = otps.findValid(mobile, 'signup', otp);

    if (!record) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    let user;

    try {
        user = users.create(record.payload);
    } catch (err) {
        // Someone registered the same username/email/mobile after this OTP
        // was requested; the uniqueness checks above ran before that.
        if (/UNIQUE constraint failed/.test(err.message)) {
            otps.markUsed(record.id);
            return res.status(409).json({ error: 'An account with these details already exists. Try logging in instead.' });
        }

        throw err;
    }

    otps.markUsed(record.id);
    setSessionCookie(res, user.id);

    res.status(201).json({ user: publicUser(user) });
});

router.post('/login/request-otp', async (req, res) => {
    const mobile = String(req.body.mobile ?? '').trim();

    if (!MOBILE_PATTERN.test(mobile)) {
        return res.status(400).json({ error: 'Mobile number must be exactly 10 digits.' });
    }

    const user = users.findByMobile(mobile);

    if (!user) {
        return res.status(404).json({ error: 'No account found for that mobile number. Please sign up first.' });
    }

    const { otpCode, expiresAt } = otps.create(mobile, 'login');

    try {
        await sms.sendOtp(mobile, otpCode);
    } catch (err) {
        return res.status(502).json({ error: 'Could not send SMS: ' + err.message });
    }

    res.json(otpResponse({ message: 'OTP sent to your mobile number.', expiresAt }, otpCode));
});

router.post('/login/verify-otp', (req, res) => {
    const mobile = String(req.body.mobile ?? '').trim();
    const otp = String(req.body.otp ?? '').trim();

    const record = otps.findValid(mobile, 'login', otp);

    if (!record) {
        return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const user = users.findByMobile(mobile);

    if (!user) {
        return res.status(404).json({ error: 'No account found for that mobile number.' });
    }

    otps.markUsed(record.id);
    setSessionCookie(res, user.id);

    res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
    const sessionId = req.cookies && req.cookies.sid;

    if (sessionId) {
        sessions.destroy(sessionId);
    }

    res.clearCookie('sid');
    res.json({ ok: true });
});

router.get('/me', (req, res) => {
    if (!req.user) {
        return res.json({ user: null });
    }

    res.json({ user: publicUser(req.user) });
});

module.exports = router;
