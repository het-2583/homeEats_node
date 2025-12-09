import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../prisma';
export function issueTokens(payload) {
    const access = jwt.sign(payload, env.jwtSecret, { expiresIn: '1d' });
    const refresh = jwt.sign({ ...payload, type: 'refresh' }, env.jwtSecret, { expiresIn: '7d' });
    return { access, refresh };
}
export function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header)
        return res.status(401).json({ detail: 'Authentication credentials were not provided.' });
    const [, token] = header.split(' ');
    try {
        const decoded = jwt.verify(token, env.jwtSecret);
        req.user = { id: decoded.id, user_type: decoded.user_type };
        next();
    }
    catch (err) {
        return res.status(401).json({ detail: 'Invalid or expired token.' });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user)
            return res.status(401).json({ detail: 'Unauthorized' });
        if (!roles.includes(req.user.user_type))
            return res.status(403).json({ detail: 'Forbidden' });
        next();
    };
}
export function currentUser(req) {
    if (!req.user)
        return undefined;
    return prisma.user.findUnique({ where: { id: req.user.id } });
}
//# sourceMappingURL=auth.js.map