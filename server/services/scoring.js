// Single source of truth for recovery scoring (the dashboard routes import this too).
const RECOVERABILITY = {
    metal: 0.95,
    glass: 0.90,
    paper: 0.85,
    plastic: 0.70,
    "e-waste": 0.50,
    textile: 0.40,
    other: 0.10,
    food: 0
};

const CONTAMINATION_WEIGHT = 0.6;
const HAZARD_PENALTY_EACH = 5;
const HAZARD_PENALTY_MAX = 20;

function gradeFor(score) {
    if (score >= 80) return "A";
    if (score >= 65) return "B";
    if (score >= 50) return "C";
    if (score >= 35) return "D";
    return "E";
}

// Recoverable share (0-1) of a material mix. Shares are normalised so a
// model answer that sums to 92% or 108% still gives a fair result.
function recoverablePotential(materials) {
    const total = materials.reduce((sum, m) => sum + m.share_pct, 0);
    if (total <= 0) return 0;

    return materials.reduce((sum, m) => {
        const weight = RECOVERABILITY[m.type] ?? RECOVERABILITY.other;
        return sum + (m.share_pct / total) * weight;
    }, 0);
}

function calculateRecoveryScore(analysis) {
    const potential = 100 * recoverablePotential(analysis.materials);

    let score = potential * (1 - CONTAMINATION_WEIGHT * analysis.contamination.score);

    score -= Math.min(
        HAZARD_PENALTY_MAX,
        HAZARD_PENALTY_EACH * analysis.hazard_flags.length
    );

    score = Math.max(0, Math.min(100, score));

    return {
        score: Number(score.toFixed(2)),
        grade: gradeFor(score)
    };
}

// A single photo cannot give a precise number, so the less sure the model is,
// the wider the range we show (up to +/-20 points at zero confidence).
const MAX_UNCERTAINTY = 20;

function calculateScoreRange(analysis) {
    const { score } = calculateRecoveryScore(analysis);
    const confidence = Math.max(0, Math.min(1, analysis.confidence ?? 1));
    const spread = Math.round((1 - confidence) * MAX_UNCERTAINTY);

    return {
        low: Math.max(0, Math.round(score - spread)),
        high: Math.min(100, Math.round(score + spread)),
        spread
    };
}

function calculateProjectedGain(analysis, contaminationReduction = 0.5) {
    const current = calculateRecoveryScore(analysis);

    const projected = calculateRecoveryScore({
        ...analysis,
        contamination: {
            ...analysis.contamination,
            score: analysis.contamination.score * (1 - contaminationReduction)
        }
    });

    return {
        currentScore: current.score,
        projectedScore: projected.score,
        gain: Number((projected.score - current.score).toFixed(2)),
        assumption: `Estimated using a ${Math.round(contaminationReduction * 100)}% reduction in contamination.`
    };
}

// Score at several contamination reductions, so the UI can offer a
// "what if" slider without re-implementing the formula in the browser.
function calculateProjections(analysis, reductions = [0, 0.25, 0.5, 0.75, 1]) {
    return reductions.map(reduction => ({
        reduction,
        ...calculateProjectedGain(analysis, reduction),
        grade: calculateRecoveryScore({
            ...analysis,
            contamination: {
                ...analysis.contamination,
                score: analysis.contamination.score * (1 - reduction)
            }
        }).grade
    }));
}

module.exports = {
    RECOVERABILITY,
    recoverablePotential,
    calculateRecoveryScore,
    calculateScoreRange,
    calculateProjectedGain,
    calculateProjections
};
