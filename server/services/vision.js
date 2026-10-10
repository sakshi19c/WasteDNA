const { GoogleGenAI } = require("@google/genai");
const { analysisSchema } = require("./schema");

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client;
function getClient() {
    // Created lazily so dotenv has always run first.
    client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    return client;
}

const prompt = `
You are the WasteDNA waste-analysis vision system.

Analyze the uploaded waste image and return ONLY valid JSON in this structure:

{
  "materials": [
    { "type": "plastic | paper | food | metal | glass | e-waste | textile | other",
      "share_pct": number,
      "notes": "short observation",
      "notes_hi": "the same observation in simple Hindi (Devanagari)" }
  ],
  "contamination": {
    "level": "low | medium | high",
    "score": number between 0 and 1,
    "sources": ["food", "other"]
  },
  "hazard_flags": [],
  "expected_stream": "dry | wet | mixed",
  "confidence": number between 0 and 1,
  "limitations": "brief limitation of image-based analysis",
  "limitations_hi": "the same limitation in simple Hindi (Devanagari)"
}

Rules:
- Estimate material percentages from the visible waste; they should sum to about 100.
- Do not invent objects that cannot reasonably be seen. Use "other" for unclassifiable items.
- If the image does not show waste, return "materials": [], confidence 0,
  and say what you see in "limitations".
- Hazard flags may only be "battery", "sanitary", "sharps", "chemical". Be conservative.
- contamination.score is how much recyclable material is soiled or mixed with
  non-recyclables (0 = clean, 1 = fully contaminated).
- Write notes_hi and limitations_hi in plain, everyday Hindi in Devanagari script, the way a
  ward worker would say it. Keep the material "type" values and all numbers as specified above.
- contamination.sources lists the main causes (for example "food"), not every visible material.
`;

function extractJson(text) {
    const cleaned = text
        .replace(/^```(?:json)?/i, "")
        .replace(/```$/, "")
        .trim();
    return JSON.parse(cleaned);
}

async function generateAnalysis(imageBuffer, mimeType) {
    const response = await getClient().models.generateContent({
        model: MODEL,
        contents: [
            { inlineData: { mimeType, data: imageBuffer.toString("base64") } },
            { text: prompt }
        ],
        config: {
            responseMimeType: "application/json",
            temperature: 0.2
        }
    });

    return analysisSchema.parse(extractJson(response.text));
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function analyzeImage(imageBuffer, mimeType, attempts = 2) {
    let lastError;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await generateAnalysis(imageBuffer, mimeType);
        } catch (error) {
            lastError = error;
            console.warn(`Vision attempt ${attempt}/${attempts} failed: ${error.message}`);
            if (attempt < attempts) await sleep(700 * attempt);
        }
    }

    throw new Error(`Vision analysis failed after ${attempts} attempts: ${lastError.message}`);
}

module.exports = { analyzeImage };
