# WasteDNA review

## Fix first

1. **Your `.env` was inside the zip.** It contains a live Gemini key and DB password. Rotate both.
   `.gitignore` already excludes `.env`; the problem is how the project was packaged. `.env.example` is included now.
2. **The Find Leaks page could never load.** In `FindLeaks.jsx` the second `.then()` read `sourcesData`,
   which only existed inside the first `.then()`. Every visit threw a ReferenceError and showed the error state. Fixed.
3. **`schema.sql` was empty (0 bytes).** Nobody could recreate the database. I reconstructed it from the queries
   in the code. Compare it with your live DB before using it anywhere that holds data.
4. **The "Track Impact" page contradicted itself.** The header showed the latest week's score, but the
   projection was computed from week 1, so the "current" number in the projection didn't match. The projection now uses the latest week.
5. **The demo story didn't demonstrate anything.** Ward C was seeded with 4 weeks of getting worse and no weeks after the
   intervention, so the page could not show an effect. Seed data now runs 8 weeks, with the intervention starting in week 5.

## Backend

| Issue | Change |
| --- | --- |
| `server` imported `@google/genai` but only the root `package.json` declared it | Added to `server/package.json`; added `start`, `dev`, `seed`, `test` scripts |
| `dotenv` path was `../.env`, relative to wherever you launched node | Resolved from `__dirname` |
| Recoverability weights were copied into both `scoring.js` and `dashboard.js` | One export, imported everywhere |
| Gemini JSON was parsed by stripping code fences | Request `responseMimeType: application/json`; fence-strip kept as a fallback; retry now backs off |
| Model returned shares that didn't sum to 100 and the score silently skewed | Shares are normalised before scoring |
| Non-waste photos produced a made-up result | Prompt instructs an empty result; API answers 422 with a helpful message |
| `contamination.sources` was free text, so `includes("food")` could miss | Lower-cased and trimmed in the schema |
| Any upload type accepted; raw `error.message` returned to the client | Image-type filter, 10 MB limit with friendly errors, generic message for 500s |
| No limit on a paid API call | Per-IP limiter (10 scans/minute). Swap for `express-rate-limit` + shared store if you run several instances |
| Seed script duplicated rows on every run and hand-typed recovery scores | Idempotent; scores computed with the real formula |
| `test-*.js` were manual scripts, not tests | Moved to `scripts/`; real `node --test` suite with assertions (8 passing) |
| No endpoint to list locations; Track Impact hard-coded location 3 | Added `GET /api/dashboard/locations` |
| Analyze response had no way to power a "what if" view | Added `projections` (score at 0/25/50/75/100% less contamination) |

## Things I did not change, but you should decide on

- **Contamination is counted twice.** Food has recoverability 0 *and* raises contamination, which then multiplies the
  score down by up to 60%. That may be intended; if not, it over-penalises wet waste.
- **Confidence is collected but never used in scoring.** The UI now warns on low confidence; you could also widen or
  hide the score.
- **Real scans never reach the dashboards.** `saveObservation` stores `is_simulated = false`, but every dashboard query
  filters on `is_simulated = TRUE`. A "log this scan to a location and week" control in the UI plus a live-data toggle
  would close the loop and make the product real.
- **No authentication.** Anyone can call `/api/analyze` and write observations.
- **Hazard data in the impact projection is fabricated** (`Array(n).fill("chemical")`) because observations store only a count.
  Store the flags themselves if the projection should be exact.
- **Segregation score is just `100 - contamination`.** If that is the definition, call it that; if not, it needs its own input.

## Frontend

- **Navigation:** one long page with three stacked sections became three tabs (Scan a bin, Find leaks, Track progress)
  with a bottom tab bar on phones. Pages stay mounted so a scan result survives switching tabs.
- **Scan:** drag-and-drop, paste, "Take photo" on phones, a built-in sample photo, a scanning animation with live status text,
  a recovery gauge, and the material "strand" (each rung is a slice of the mix; hover a material to isolate it), contamination, hazards,
  waste stream, confidence, a "what if contamination dropped?" slider, and a copy-summary button.
- **Find leaks:** the headline is now the finding ("Ward C is losing the most recyclable material"), a sortable ranking with
  sparklines and "Repeat hotspot" flags, and a week-by-location heatmap replacing four separate tables.
- **Track progress:** a location picker, a responsive chart (the old one was fixed at 600px), an intervention marker,
  a metric toggle, a plain-language verdict, and a now/projected comparison.
- **Quality:** light and dark themes, keyboard focus styles, ARIA labels on every chart and meter, reduced-motion support,
  no hard-coded `localhost:5000` (Vite proxy in dev, `VITE_API_URL` in production), error and loading states on every request.
- Unused Vite template files (hero image, logos, `App.css`) are removed.

## How it was checked

Server: 8 unit tests pass. Client: `npm run lint` is clean and `npm run build` succeeds. I rendered all three pages
against a mock API in headless Chromium at desktop and phone width, in both themes. I could not run the real backend
here (no MySQL, and no Gemini key), so run a real scan once to confirm the model output parses.
