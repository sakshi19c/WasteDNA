const db = require("../db/connection");

async function saveObservation({
    locationId,
    week,
    photoRef,
    analysis,
    recovery
}) {
    const segregationScore =
        100 * (1 - analysis.contamination.score);

    const query = `
        INSERT INTO observations (
            location_id,
            week,
            photo_ref,
            materials_json,
            contamination,
            hazard_count,
            recovery_score,
            segregation_score,
            is_simulated
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        locationId,
        week,
        photoRef,
        JSON.stringify(analysis.materials),
        analysis.contamination.score,
        analysis.hazard_flags.length,
        recovery.score,
        Number(segregationScore.toFixed(2)),
        false
    ];

    const [result] = await db.execute(query, values);

    return {
        id: result.insertId,
        segregationScore: Number(segregationScore.toFixed(2))
    };
}

module.exports = {
    saveObservation
};