const { z } = require("zod");

const materialSchema = z.object({
    type: z.enum([
        "plastic", "paper", "food", "metal",
        "glass", "e-waste", "textile", "other"
    ]),
    share_pct: z.number().min(0).max(100),
    notes: z.string(),
    // Hindi version of the note. Optional: the interface falls back to English if missing.
    notes_hi: z.string().optional()
});

const analysisSchema = z.object({
    materials: z.array(materialSchema),

    contamination: z.object({
        level: z.enum(["low", "medium", "high"]),
        score: z.number().min(0).max(1),
        // Free text from the model: normalise so recommend.js matches reliably.
        sources: z.array(z.string()).transform(list =>
            list.map(item => item.trim().toLowerCase())
        )
    }),

    hazard_flags: z.array(
        z.enum(["battery", "sanitary", "sharps", "chemical"])
    ),

    expected_stream: z.enum(["dry", "wet", "mixed"]),

    confidence: z.number().min(0).max(1),

    limitations: z.string(),
    limitations_hi: z.string().optional()
});

module.exports = { analysisSchema };
