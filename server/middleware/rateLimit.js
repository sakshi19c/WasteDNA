// Tiny in-memory limiter to protect the paid Gemini call.
// For multiple server instances, swap for express-rate-limit + a shared store.
function rateLimit({ windowMs = 60_000, max = 10 } = {}) {
    const hits = new Map();

    setInterval(() => {
        const cutoff = Date.now() - windowMs;
        for (const [key, times] of hits) {
            const recent = times.filter(t => t > cutoff);
            recent.length ? hits.set(key, recent) : hits.delete(key);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const now = Date.now();
        const recent = (hits.get(req.ip) ?? []).filter(t => t > now - windowMs);

        if (recent.length >= max) {
            return res.status(429).json({
                error: "rate_limited",
                message: "Too many scans in a short time. Wait a minute and try again."
            });
        }

        recent.push(now);
        hits.set(req.ip, recent);
        next();
    };
}

module.exports = { rateLimit };
