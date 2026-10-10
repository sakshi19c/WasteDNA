// Where each material should go, using the three-stream colour code of the
// Solid Waste Management Rules 2016 / Swachh Bharat Mission:
//   green = wet (biodegradable), blue = dry recyclables,
//   black = domestic hazardous and sanitary waste.
// E-waste is not a household-bin stream: it goes to an authorised collector
// under the E-Waste (Management) Rules.
const BIN_FOR = {
    food: "wet",
    plastic: "dry",
    paper: "dry",
    metal: "dry",
    glass: "dry",
    textile: "dry",
    other: "dry",
    "e-waste": "ewaste"
};

const ORDER = ["wet", "dry", "hazardous", "ewaste"];

function getRouting(analysis) {
    const total = analysis.materials.reduce((sum, m) => sum + m.share_pct, 0) || 1;
    const bins = new Map();

    for (const material of analysis.materials) {
        const id = BIN_FOR[material.type] ?? "dry";
        const bin = bins.get(id) ?? { id, share_pct: 0, items: [] };
        bin.share_pct += (material.share_pct / total) * 100;
        if (!bin.items.includes(material.type)) bin.items.push(material.type);
        bins.set(id, bin);
    }

    // Hazard flags have no measured share, only presence.
    if (analysis.hazard_flags.length > 0) {
        bins.set("hazardous", {
            id: "hazardous",
            share_pct: null,
            items: [...analysis.hazard_flags]
        });
    }

    return ORDER
        .filter(id => bins.has(id))
        .map(id => {
            const bin = bins.get(id);
            return bin.share_pct === null
                ? bin
                : { ...bin, share_pct: Number(bin.share_pct.toFixed(1)) };
        });
}

module.exports = { getRouting, BIN_FOR };
