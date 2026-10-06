const sessions = require('../models/sessions');
const users = require('../models/users');

function attachUser(req, res, next) {
    res.locals.user = null;

    const sessionId = req.cookies && req.cookies.sid;
    const session = sessions.findValid(sessionId);

    if (session) {
        const user = users.findById(session.user_id);

        if (user) {
            req.user = user;
            res.locals.user = user;
        }
    }

    next();
}

function requireAuth(req, res, next) {
    if (!req.user) {
        if (req.originalUrl.startsWith('/api/')) {
            return res.status(401).json({ error: 'Login required' });
        }

        if (req.originalUrl === '/') {
            return res.redirect('/login');
        }

        return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
    }

    next();
}

module.exports = { attachUser, requireAuth };
