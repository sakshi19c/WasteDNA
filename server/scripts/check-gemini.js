require("dotenv").config({
    path: require("path").resolve(__dirname, "../../.env")
});

const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

async function testGemini() {
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Reply with exactly: WasteDNA Gemini connection successful"
        });

        console.log(response.text);
    } catch (error) {
        console.error("Gemini connection failed:");
        console.error(error.message);
    }
}

testGemini();