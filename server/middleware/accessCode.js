// Optional shared access code for the paid /api/analyze call. Leave
// ACCESS_CODE unset for open local development.
const crypto = require("crypto");

function sameCode(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function accessCode(req, res, next) {
    const required = process.env.ACCESS_CODE;
    if (!required) return next();

    if (sameCode(req.get("x-access-code") ?? "", required)) return next();

    res.status(401).json({
        error: "access_required",
        message: "Enter the access code to run a scan."
    });
}

module.exports = { accessCode };
