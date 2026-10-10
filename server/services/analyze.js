const sharp = require("sharp");

const { analyzeImage } = require("./vision");
const { calculateRecoveryScore, calculateScoreRange, calculateProjections } = require("./scoring");
const { getDiagnosis } = require("./recommend");
const { getRouting } = require("./routing");

class AnalysisError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
    }
}

// Re-encode the photo before it leaves our server. sharp drops metadata by
// default, so GPS coordinates and device details in the EXIF block are never
// sent to the AI service. Oversized photos are also shrunk, which is faster
// and cheaper. If the format cannot be decoded we fall back to the original.
async function sanitizeImage(buffer, mimeType) {
    try {
        const clean = await sharp(buffer)
            .rotate()
            .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();
        return { buffer: clean, mimeType: "image/jpeg", metadataStripped: true };
    } catch {
        return { buffer, mimeType, metadataStripped: false };
    }
}

async function analyzeWaste(imageBuffer, mimeType) {
    const image = await sanitizeImage(imageBuffer, mimeType);
    const analysis = await analyzeImage(image.buffer, image.mimeType);

    if (analysis.materials.length === 0) {
        throw new AnalysisError(
            "No waste was found in this photo. Try a closer, well-lit shot of the bin or bag contents.",
            422
        );
    }

    const recovery = {
        ...calculateRecoveryScore(analysis),
        range: calculateScoreRange(analysis)
    };
    const advice = getDiagnosis(analysis);

    return {
        analysis,
        recovery,
        diagnosis: advice.diagnosis,
        recommendation: advice.recommendation,
        diagnosis_hi: advice.diagnosis_hi,
        recommendation_hi: advice.recommendation_hi,
        routing: getRouting(analysis),
        projections: calculateProjections(analysis),
        privacy: { metadataStripped: image.metadataStripped, photoStored: false }
    };
}

module.exports = { analyzeWaste, AnalysisError, sanitizeImage };
