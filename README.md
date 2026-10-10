# WasteDNA

Photo of a bin in, recovery score and next step out. Then see where recyclable material
is being lost across locations, and whether an intervention is working.

## Run it

1. Create a MySQL database, then load `server/db/schema.sql`.
2. Copy `.env.example` to `.env` and fill in the DB details and `GEMINI_API_KEY`.
3. Backend:
   ```
   cd server
   npm install
   npm run seed     # demo data, safe to re-run
   npm run dev      # http://localhost:5000
   npm test         # scoring and schema tests
   ```
4. Frontend:
   ```
   cd client
   npm install
   npm run dev      # http://localhost:5173  (proxies /api to the backend)
   ```

For a deployed frontend, set `VITE_API_URL` at build time. On the server, set `CORS_ORIGIN`.

## What it does

| Feature | Detail |
| --- | --- |
| Scan a bin | Gemini vision returns a validated material mix, contamination, hazards and confidence. A transparent formula turns that into a recovery score, A to E grade and a likely range (wider when the model is less sure). |
| Bin routing | Each material is routed to the Swachh Bharat colour-coded stream used under the Solid Waste Management Rules 2016: green wet, blue dry, black hazardous and sanitary, plus an authorised e-waste collector. |
| Hindi | The language button switches the whole interface (all three pages, charts, messages and the scan result, including the model's own notes) between English and Hindi. Ward names and the seeded intervention note are translated from a table; anything a user adds is shown as typed. |
| Live data | In the scan page, "Log to a ward" saves the scan. Find leaks and Track progress can switch between seeded **Demo data** and **Live scans**. |
| Pilot estimator | Sizes what a pilot could recover for one ward. Every input (households, kg per home, scrap price) is an editable assumption. |
| Privacy | Photos are re-encoded before analysis, which removes EXIF/GPS metadata. They are not stored; only the file name is kept with a logged scan. |

## Method and assumptions

- **Recovery score** = recoverable share of the material mix x (1 - 0.6 x contamination) - hazard penalty (5 per hazard, max 20). Recoverability weights (metal 0.95, glass 0.90, paper 0.85, plastic 0.70, e-waste 0.50, textile 0.40, other 0.10, food 0) are **our assumptions**, not measured values. Calibrate them with municipal audit or CPCB composition data before relying on absolute numbers.
- Food waste lowers the score twice (zero recoverability and as contamination). This is deliberate: wet waste is the main cause of spoiled dry recyclables. It does mean wet-heavy bins score low.
- The leak and progress dashboards ship with **synthetic seed data** (`npm run seed`) and are labelled as demo data. Only scans logged to a ward appear under Live scans.
- Scores come from one photo and are estimates. Confidence below 50% shows a warning.

## Tests

`cd server && npm test` runs 17 tests: scoring, schema, bin routing, Hindi coverage, the confidence range, EXIF stripping and the access code.

## Deploy

See `DEPLOY.md`. A `Dockerfile` builds one service that serves the API and client and sets up its own database on first boot. Set `ACCESS_CODE` to protect the Gemini quota.
