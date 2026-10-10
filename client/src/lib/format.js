// Material colors follow the sorting vocabulary people already know from bins:
// blue for dry recyclables, green for wet/organic, and distinct hues for the rest.
export const MATERIALS = {
  plastic: { label: 'Plastic', color: '#2F6BFF' },
  paper: { label: 'Paper', color: '#D9A441' },
  food: { label: 'Food', color: '#3FAE5A' },
  metal: { label: 'Metal', color: '#9FB0C3' },
  glass: { label: 'Glass', color: '#22C3C8' },
  'e-waste': { label: 'E-waste', color: '#8B5CF6' },
  textile: { label: 'Textile', color: '#E85D9B' },
  other: { label: 'Other', color: '#6B7782' },
}

export const materialInfo = (type) => MATERIALS[type] ?? MATERIALS.other

export const HAZARDS = {
  battery: 'Battery',
  sanitary: 'Sanitary waste',
  sharps: 'Sharps',
  chemical: 'Chemicals',
}

export const STREAMS = {
  dry: { label: 'Dry', note: 'Mostly dry recyclables' },
  wet: { label: 'Wet', note: 'Mostly wet, organic waste' },
  mixed: { label: 'Mixed', note: 'Wet and dry waste together' },
}

export const GRADE_NOTES = {
  A: 'Excellent. Almost everything here can be recovered.',
  B: 'Good. Most of this material can be recovered.',
  C: 'Fair. A lot of value is lost to mixing.',
  D: 'Poor. Most recyclable value is being lost.',
  E: 'Very poor. Little can be recovered as it is.',
}

// Same bands the server uses for contamination (percent in, level out).
export const severity = (percent) => (percent >= 50 ? 'high' : percent >= 20 ? 'medium' : 'low')
export const SEVERITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High' }

// Score -> tone class, matching the grade bands in services/scoring.js.
export const tone = (score) =>
  score >= 80 ? 'a' : score >= 65 ? 'b' : score >= 50 ? 'c' : score >= 35 ? 'd' : 'e'

export const percent = (n) => `${Math.round(n)}%`

// ISO-8601 week number, used as the default week when logging a live scan.
export function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}
