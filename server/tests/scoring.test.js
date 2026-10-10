const test = require("node:test");
const assert = require("node:assert/strict");

const { analysisSchema } = require("../services/schema");
const {
    calculateRecoveryScore,
    calculateProjectedGain,
    calculateProjections
} = require("../services/scoring");
const { getDiagnosis } = require("../services/recommend");

const make = (overrides = {}) => ({
    materials: [
        { type: "plastic", share_pct: 45, notes: "bottles" },
        { type: "paper", share_pct: 25, notes: "packaging" },
        { type: "food", share_pct: 30, notes: "scraps" }
    ],
    contamination: { level: "high", score: 0.7, sources: ["food"] },
    hazard_flags: [],
    expected_stream: "mixed",
    confidence: 0.9,
    limitations: "single image",
    ...overrides
});

test("scores the reference sample", () => {
    const { score, grade } = calculateRecoveryScore(make());
    // potential = 45*.70 + 25*.85 = 52.75; x (1 - .6*.7) = 30.595
    assert.equal(score, 30.6);
    assert.equal(grade, "E");
});

test("a clean metal-only bin scores 95 (grade A)", () => {
    const result = calculateRecoveryScore(make({
        materials: [{ type: "metal", share_pct: 100, notes: "" }],
        contamination: { level: "low", score: 0, sources: [] }
    }));
    assert.deepEqual(result, { score: 95, grade: "A" });
});

test("hazard penalty is capped at 20 points", () => {
    const base = make({ contamination: { level: "low", score: 0, sources: [] } });
    const none = calculateRecoveryScore(base).score;
    const many = calculateRecoveryScore({ ...base, hazard_flags: ["battery", "sharps", "sanitary", "chemical"] }).score;
    assert.equal(Number((none - many).toFixed(2)), 20);
});

test("shares that do not sum to 100 are normalised", () => {
    const a = calculateRecoveryScore(make());
    const scaled = make();
    scaled.materials = scaled.materials.map(m => ({ ...m, share_pct: m.share_pct * 0.8 }));
    assert.equal(calculateRecoveryScore(scaled).score, a.score);
});

test("score never leaves 0-100", () => {
    const worst = calculateRecoveryScore(make({
        materials: [{ type: "food", share_pct: 100, notes: "" }],
        hazard_flags: ["battery", "sharps", "sanitary", "chemical"]
    }));
    assert.equal(worst.score, 0);
});

test("projections rise as contamination falls", () => {
    const scores = calculateProjections(make()).map(p => p.projectedScore);
    assert.deepEqual([...scores].sort((a, b) => a - b), scores);
    assert.equal(calculateProjectedGain(make(), 0).gain, 0);
});

test("diagnosis branches", () => {
    assert.match(getDiagnosis(make()).diagnosis, /Food waste/);
    assert.match(
        getDiagnosis(make({ contamination: { level: "medium", score: 0.3, sources: [] }, hazard_flags: ["battery"] })).diagnosis,
        /Hazardous/
    );
    assert.match(
        getDiagnosis(make({ contamination: { level: "low", score: 0.1, sources: [] } })).diagnosis,
        /well segregated/
    );
});

test("schema rejects unknown hazards and normalises sources", () => {
    assert.throws(() => analysisSchema.parse(make({ hazard_flags: ["radioactive"] })));
    const parsed = analysisSchema.parse(make({ contamination: { level: "high", score: 0.7, sources: [" Food "] } }));
    assert.deepEqual(parsed.contamination.sources, ["food"]);
});
