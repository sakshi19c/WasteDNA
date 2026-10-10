const express = require("express");
const multer = require("multer");

const { analyzeWaste, AnalysisError } = require("../services/analyze");
const { saveObservation } = require("../services/saveObservation");
const { rateLimit } = require("../middleware/rateLimit");
const { accessCode } = require("../middleware/accessCode");

const router = express.Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);
        cb(new AnalysisError("Use a JPG, PNG, WebP or HEIC photo.", 415));
    }
});

router.post("/", accessCode, rateLimit({ max: 10 }), upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "no_image",
                message: "Choose a photo to analyze."
            });
        }

        const result = await analyzeWaste(req.file.buffer, req.file.mimetype);

        // Only persist when a location and week are supplied.
        let savedObservation = null;
        const locationId = Number(req.body.location_id);
        const week = Number(req.body.week);

        if (Number.isInteger(locationId) && Number.isInteger(week) && locationId > 0 && week > 0) {
            savedObservation = await saveObservation({
                locationId,
                week,
                photoRef: req.file.originalname,
                analysis: result.analysis,
                recovery: result.recovery
            });
        }

        res.json({ ...result, savedObservation });
    } catch (error) {
        console.error("Analysis error:", error);

        // Client-safe messages for expected failures; no internals for the rest.
        if (error.status && error.status < 500) {
            return res.status(error.status).json({ error: "analysis_rejected", message: error.message });
        }

        res.status(500).json({
            error: "analysis_failed",
            message: "The scan couldn't be completed. Try again, or use a clearer photo."
        });
    }
});

// Multer errors (file too large, wrong type) land here.
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        const message = error.code === "LIMIT_FILE_SIZE"
            ? "That photo is over 10 MB. Choose a smaller one."
            : "The upload failed. Try a different photo.";
        return res.status(400).json({ error: error.code, message });
    }
    if (error.status) {
        return res.status(error.status).json({ error: "bad_upload", message: error.message });
    }
    next(error);
});

module.exports = router;
