// Each message is kept in English and Hindi so field staff and residents can
// read the advice in the language they use.
const MESSAGES = {
    food: {
        diagnosis: "Food waste is contaminating recyclable materials.",
        recommendation: "Separate wet food waste into a dedicated wet-waste bin.",
        diagnosis_hi: "खाने का गीला कचरा रीसायकल होने लायक़ सामग्री को गंदा कर रहा है।",
        recommendation_hi: "गीले खाने के कचरे को अलग करके हरे डिब्बे (गीला कचरा) में डालें।"
    },
    hazard: {
        diagnosis: "Hazardous waste is mixed with regular waste.",
        recommendation: "Separate hazardous items and send them to an authorized drop-off point.",
        diagnosis_hi: "ख़तरनाक कचरा सामान्य कचरे में मिला हुआ है।",
        recommendation_hi: "ख़तरनाक चीज़ों को अलग करें और अधिकृत संग्रह केंद्र में दें।"
    },
    ewaste: {
        diagnosis: "A significant amount of e-waste is mixed with other waste.",
        recommendation: "Send electronic waste to an authorized e-waste collector.",
        diagnosis_hi: "काफ़ी मात्रा में ई-कचरा दूसरे कचरे में मिला हुआ है।",
        recommendation_hi: "इलेक्ट्रॉनिक कचरा अधिकृत ई-कचरा संग्राहक को दें।"
    },
    good: {
        diagnosis: "Waste is relatively well segregated with low contamination.",
        recommendation: "Maintain source segregation and arrange recyclable pickup.",
        diagnosis_hi: "कचरा काफ़ी हद तक सही ढंग से अलग किया गया है और मिलावट कम है।",
        recommendation_hi: "जहाँ कचरा निकलता है, वहीं उसे अलग करना जारी रखें और रीसायकल योग्य कचरे के उठान की व्यवस्था करें।"
    },
    mixed: {
        diagnosis: "Recyclable materials are being lost because of mixed waste.",
        recommendation: "Improve source segregation at the point where waste is generated.",
        diagnosis_hi: "गीले-सूखे कचरे के मिल जाने से रीसायकल योग्य सामग्री बर्बाद हो रही है।",
        recommendation_hi: "जहाँ कचरा निकलता है, वहीं गीला और सूखा कचरा अलग-अलग डिब्बों में डालना शुरू करें।"
    }
};

function getDiagnosis(analysis) {
    const contamination = analysis.contamination.score;
    const sources = analysis.contamination.sources;

    if (contamination >= 0.5 && sources.includes("food")) return MESSAGES.food;
    if (analysis.hazard_flags.length > 0) return MESSAGES.hazard;

    const eWaste = analysis.materials.find(material => material.type === "e-waste");
    if (eWaste && eWaste.share_pct >= 20) return MESSAGES.ewaste;

    if (contamination < 0.2) return MESSAGES.good;
    return MESSAGES.mixed;
}

module.exports = { getDiagnosis };
