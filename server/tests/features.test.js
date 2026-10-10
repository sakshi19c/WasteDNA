const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const { getRouting } = require("../services/routing");
const { calculateScoreRange } = require("../services/scoring");
const { getDiagnosis } = require("../services/recommend");
const { sanitizeImage } = require("../services/analyze");

const make = (overrides = {}) => ({
    materials: [
        { type: "plastic", share_pct: 40, notes: "" },
        { type: "paper", share_pct: 20, notes: "" },
        { type: "food", share_pct: 30, notes: "" },
        { type: "e-waste", share_pct: 10, notes: "" }
    ],
    contamination: { level: "high", score: 0.6, sources: ["food"] },
    hazard_flags: [],
    expected_stream: "mixed",
    confidence: 0.9,
    limitations: "",
    ...overrides
});

test("routing sends food to wet, recyclables to dry, e-waste to its own stream", () => {
    const bins = Object.fromEntries(getRouting(make()).map(b => [b.id, b]));
    assert.equal(bins.wet.share_pct, 30);
    assert.equal(bins.dry.share_pct, 60);
    assert.equal(bins.ewaste.share_pct, 10);
    assert.deepEqual(bins.dry.items, ["plastic", "paper"]);
    assert.equal(bins.hazardous, undefined);
});

test("routing shares are normalised and hazards get a black bin", () => {
    const routing = getRouting(make({
        materials: [{ type: "plastic", share_pct: 45 }, { type: "food", share_pct: 45 }],
        hazard_flags: ["battery", "sharps"]
    }));
    assert.deepEqual(routing.map(b => b.id), ["wet", "dry", "hazardous"]);
    assert.equal(routing[0].share_pct, 50);
    assert.deepEqual(routing[2].items, ["battery", "sharps"]);
});

test("score range widens as confidence falls and stays within 0-100", () => {
    const sure = calculateScoreRange(make({ confidence: 1 }));
    const unsure = calculateScoreRange(make({ confidence: 0.25 }));
    assert.equal(sure.spread, 0);
    assert.equal(unsure.spread, 15);
    assert.ok(unsure.low >= 0 && unsure.high <= 100);
    assert.ok(unsure.high - unsure.low > sure.high - sure.low);
});

test("every diagnosis has a Hindi version", () => {
    const cases = [
        make(),
        make({ contamination: { level: "medium", score: 0.3, sources: [] }, hazard_flags: ["battery"] }),
        make({ contamination: { level: "medium", score: 0.3, sources: [] }, materials: [{ type: "e-waste", share_pct: 60 }, { type: "plastic", share_pct: 40 }] }),
        make({ contamination: { level: "low", score: 0.05, sources: [] } }),
        make({ contamination: { level: "medium", score: 0.35, sources: [] } })
    ];
    for (const analysis of cases) {
        const advice = getDiagnosis(analysis);
        assert.match(advice.diagnosis_hi, /[ऀ-ॿ]/);
        assert.match(advice.recommendation_hi, /[ऀ-ॿ]/);
    }
});

test("sanitizeImage removes GPS EXIF data and shrinks large photos", async () => {
    const withGps = await sharp({
        create: { width: 2400, height: 1800, channels: 3, background: "#456" }
    })
        .jpeg()
        .withExif({ IFD0: { Copyright: "private" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "12/1 58/1 0/1" } })
        .toBuffer();

    assert.ok((await sharp(withGps).metadata()).exif, "fixture should carry EXIF");

    const clean = await sanitizeImage(withGps, "image/jpeg");
    const meta = await sharp(clean.buffer).metadata();

    assert.equal(clean.metadataStripped, true);
    assert.equal(clean.mimeType, "image/jpeg");
    assert.equal(meta.exif, undefined);
    assert.equal(Math.max(meta.width, meta.height), 1600);
});

test("sanitizeImage falls back to the original bytes for undecodable input", async () => {
    const junk = Buffer.from("not an image");
    const out = await sanitizeImage(junk, "image/png");
    assert.equal(out.metadataStripped, false);
    assert.equal(out.buffer, junk);
});

test("the bundled sample photo can be sanitised", async () => {
    const sample = fs.readFileSync(path.join(__dirname, "../test-images/trash.webp"));
    const out = await sanitizeImage(sample, "image/webp");
    assert.equal(out.metadataStripped, true);
});

test("the Hindi interface text has every key the English text has", async () => {
    // i18n.js is an ES module that imports React; read it as text and compare the key paths.
    const src = fs.readFileSync(path.join(__dirname, "../../client/src/lib/i18n.js"), "utf8")
        .replace(/^import .*$/m, "const createContext = () => ({}), useContext = () => 'en'")
        .replace(/export /g, "");
    const { T } = new Function(`${src}; return { T };`)();

    const paths = (node, prefix = "") => Object.entries(node).flatMap(([key, value]) =>
        value && typeof value === "object" && !Array.isArray(value)
            ? paths(value, `${prefix}${key}.`)
            : [`${prefix}${key}`]);

    const missing = paths(T.en).filter(p => !paths(T.hi).includes(p));
    assert.deepEqual(missing, []);
});
