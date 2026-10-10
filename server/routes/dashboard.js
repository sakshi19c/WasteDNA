const express = require("express");
const db = require("../db/connection");

const {
    RECOVERABILITY,
    recoverablePotential,
    calculateProjectedGain
} = require("../services/scoring");

const router = express.Router();

// ?source=live reads real scans; anything else reads the seeded demo data.
const wantsDemo = req => (req.query.source === "live" ? 0 : 1);

const parseJson = value => (typeof value === "string" ? JSON.parse(value) : value);
const round = (value, digits = 2) => Number(value.toFixed(digits));

function fail(res, label, message) {
    return (error) => {
        console.error(`${label}:`, error);
        res.status(500).json({ error: "dashboard_failed", message });
    };
}

// Locations, used by the Track progress picker.
router.get("/locations", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT
                l.id,
                l.name,
                l.type,
                EXISTS (
                    SELECT 1 FROM interventions i WHERE i.location_id = l.id
                ) AS has_intervention
            FROM locations l
            ORDER BY l.id
        `);

        res.json({
            simulated: true,
            locations: rows.map(row => ({ ...row, has_intervention: Boolean(row.has_intervention) }))
        });
    } catch (error) {
        fail(res, "Locations error", "Failed to load locations.")(error);
    }
});

router.get("/leaks", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT l.id, l.name AS location, l.type,
                   o.materials_json, o.contamination, o.segregation_score
            FROM locations l
            JOIN observations o ON l.id = o.location_id
            WHERE o.is_simulated = ?
            ORDER BY l.id, o.week
        `, [wantsDemo(req)]);

        const byLocation = new Map();

        for (const row of rows) {
            const entry = byLocation.get(row.id) ?? {
                id: row.id,
                location: row.location,
                type: row.type,
                lost: 0,
                contamination: 0,
                segregation: 0,
                weeks: 0
            };

            const contamination = Number(row.contamination);

            entry.lost += recoverablePotential(parseJson(row.materials_json)) * contamination;
            entry.contamination += contamination;
            entry.segregation += Number(row.segregation_score);
            entry.weeks++;

            byLocation.set(row.id, entry);
        }

        const locations = [...byLocation.values()]
            .map(entry => ({
                id: entry.id,
                location: entry.location,
                type: entry.type,
                avg_contamination: round((entry.contamination / entry.weeks) * 100),
                avg_segregation_score: round(entry.segregation / entry.weeks),
                lost_recyclable_material: round((entry.lost / entry.weeks) * 100)
            }))
            .sort((a, b) => b.lost_recyclable_material - a.lost_recyclable_material);

        res.json({ simulated: Boolean(wantsDemo(req)), locations });
    } catch (error) {
        fail(res, "Dashboard error", "Failed to load WasteLeak data.")(error);
    }
});

router.get("/weekly", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT l.name AS location, o.week,
                   AVG(o.contamination) AS contamination,
                   AVG(o.segregation_score) AS segregation_score
            FROM locations l
            JOIN observations o ON l.id = o.location_id
            WHERE o.is_simulated = ?
            GROUP BY l.id, l.name, o.week
            ORDER BY o.week, contamination DESC
        `, [wantsDemo(req)]);

        const weekly = {};

        for (const row of rows) {
            (weekly[row.week] ??= []).push({
                location: row.location,
                contamination: Number(row.contamination) * 100,
                segregation_score: Number(row.segregation_score)
            });
        }

        res.json({ simulated: Boolean(wantsDemo(req)), weekly });
    } catch (error) {
        fail(res, "Weekly error", "Failed to load weekly hotspot data.")(error);
    }
});

router.get("/impact/:locationId", async (req, res) => {
    try {
        const locationId = Number(req.params.locationId);

        if (!Number.isInteger(locationId) || locationId < 1) {
            return res.status(400).json({ error: "bad_location", message: "Invalid location id." });
        }

        const [locationRows] = await db.execute(
            "SELECT id, name, type FROM locations WHERE id = ?",
            [locationId]
        );

        if (locationRows.length === 0) {
            return res.status(404).json({ error: "not_found", message: "Location not found." });
        }

        const [observations] = await db.execute(
            `SELECT week, segregation_score, recovery_score, contamination,
                    materials_json, hazard_count
             FROM observations
             WHERE location_id = ? AND is_simulated = ?
             ORDER BY week, id`,
            [locationId, wantsDemo(req)]
        );

        // Several scans can land in the same week: chart one point per week
        // (the average), and project from the last scan of the latest week.
        const byWeek = new Map();
        for (const row of observations) {
            (byWeek.get(row.week) ?? byWeek.set(row.week, []).get(row.week)).push(row);
        }
        const weeks = [...byWeek.entries()].map(([week, rows]) => {
            const avg = key => round(rows.reduce((sum, r) => sum + Number(r[key]), 0) / rows.length, 3);
            return {
                week,
                scans: rows.length,
                segregation_score: avg("segregation_score"),
                recovery_score: avg("recovery_score"),
                contamination: avg("contamination"),
                hazard_count: rows[rows.length - 1].hazard_count,
                materials_json: rows[rows.length - 1].materials_json
            };
        });

        const [interventions] = await db.execute(
            `SELECT start_week, description
             FROM interventions
             WHERE location_id = ?
             ORDER BY start_week`,
            [locationId]
        );

        // Project from the LATEST week (what the location looks like now).
        let projectedGain = null;

        if (weeks.length > 0) {
            const latest = weeks[weeks.length - 1];

            projectedGain = calculateProjectedGain({
                materials: parseJson(latest.materials_json),
                contamination: { score: Number(latest.contamination), level: "high", sources: [] },
                hazard_flags: Array(Number(latest.hazard_count)).fill("chemical"),
                expected_stream: "mixed",
                confidence: 1,
                limitations: wantsDemo(req) ? "Projection based on synthetic demonstration data." : "Projection based on logged scans."
            }, 0.5);
        }

        res.json({
            simulated: Boolean(wantsDemo(req)),
            location: locationRows[0],
            // materials_json is bulky and not needed by the chart.
            observations: weeks.map(({ materials_json, ...rest }) => rest),
            // Interventions are recorded against the demo timeline (weeks 1-8),
            // so they would sit at the wrong place on a live chart.
            interventions: wantsDemo(req) ? interventions : [],
            projectedGain
        });
    } catch (error) {
        fail(res, "Impact error", "Failed to load impact data.")(error);
    }
});

router.get("/sources", async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT materials_json, contamination
            FROM observations
            WHERE is_simulated = ?
        `, [wantsDemo(req)]);

        let food = 0;
        let other = 0;

        for (const row of rows) {
            const foodItem = parseJson(row.materials_json).find(m => m.type === "food");
            const foodShare = foodItem ? Number(foodItem.share_pct) / 100 : 0;
            const contamination = Number(row.contamination);

            food += foodShare * contamination;
            other += (1 - foodShare) * contamination;
        }

        const total = food + other;
        const pct = value => (total ? round((value / total) * 100, 1) : 0);

        res.json({
            simulated: Boolean(wantsDemo(req)),
            estimated: true,
            sources: [
                { source: "Food waste", percentage: pct(food) },
                { source: "Other mixed waste", percentage: pct(other) }
            ]
        });
    } catch (error) {
        fail(res, "Sources error", "Failed to load contamination sources.")(error);
    }
});

module.exports = router;
module.exports.RECOVERABILITY = RECOVERABILITY;
