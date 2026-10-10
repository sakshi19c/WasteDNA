const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const db = require("./connection");
const { calculateRecoveryScore } = require("../services/scoring");

// Weeks 1-4 are the original demo data. Weeks 5-8 are new, so Ward C can
// show a before/after story: an intervention starts in week 5.
const FOOD_SHARE = c => Math.round(10 + c * 45);

// location_id -> { paper share %, hazards, contamination for weeks 1..8 }
const LOCATIONS = {
    1: { paper: 25, hazards: 0, c: [0.30, 0.35, 0.40, 0.45, 0.47, 0.48, 0.50, 0.50] },
    2: { paper: 32, hazards: 0, c: [0.25, 0.28, 0.32, 0.30, 0.31, 0.29, 0.30, 0.28] },
    3: { paper: 20, hazards: 0, c: [0.70, 0.75, 0.80, 0.85, 0.62, 0.48, 0.38, 0.30] },
    4: { paper: 36, hazards: 0, c: [0.20, 0.22, 0.25, 0.23, 0.22, 0.21, 0.23, 0.22] },
    5: { paper: 23, hazards: 1, c: [0.45, 0.50, 0.55, 0.60, 0.62, 0.63, 0.66, 0.66] },
    6: { paper: 28, hazards: 0, c: [0.35, 0.38, 0.42, 0.40, 0.39, 0.37, 0.38, 0.36] },
    7: { paper: 47, hazards: 0, c: [0.15, 0.18, 0.20, 0.18, 0.17, 0.16, 0.18, 0.16] },
    8: { paper: 57, hazards: 0, c: [0.10, 0.12, 0.15, 0.13, 0.12, 0.11, 0.12, 0.10] }
};

const INTERVENTIONS = [
    [3, 5, "Door-to-door wet-waste bin distribution and a weekly segregation drive with ward volunteers."]
];

async function seedDatabase() {
    {
        // Idempotent: safe to run repeatedly (the old script duplicated rows).
        await db.execute("DELETE FROM observations WHERE is_simulated = TRUE");
        await db.execute("DELETE FROM interventions");

        for (const [locationId, spec] of Object.entries(LOCATIONS)) {
            for (const [index, contamination] of spec.c.entries()) {
                const food = FOOD_SHARE(contamination);
                const materials = [
                    { type: "plastic", share_pct: 100 - food - spec.paper },
                    { type: "paper", share_pct: spec.paper },
                    { type: "food", share_pct: food }
                ];

                // Computed with the real scoring formula, not hand-typed.
                const { score } = calculateRecoveryScore({
                    materials,
                    contamination: { score: contamination },
                    hazard_flags: Array(spec.hazards).fill("chemical")
                });

                await db.execute(
                    `INSERT INTO observations
                        (location_id, week, photo_ref, materials_json, contamination,
                         hazard_count, recovery_score, segregation_score, is_simulated)
                     VALUES (?, ?, 'simulated', ?, ?, ?, ?, ?, TRUE)`,
                    [
                        Number(locationId),
                        index + 1,
                        JSON.stringify(materials),
                        contamination,
                        spec.hazards,
                        score,
                        Number((100 * (1 - contamination)).toFixed(2))
                    ]
                );
            }
        }

        for (const [locationId, startWeek, description] of INTERVENTIONS) {
            await db.execute(
                "INSERT INTO interventions (location_id, start_week, description) VALUES (?, ?, ?)",
                [locationId, startWeek, description]
            );
        }

        console.log("Simulated WasteLeak data inserted successfully.");
    }
}

module.exports = { seedDatabase };

if (require.main === module) {
    seedDatabase()
        .then(() => process.exit(0))
        .catch(error => {
            console.error("Seeding failed:", error.message);
            process.exit(1);
        });
}
