# Deploying WasteDNA

One container serves the API and the client. It creates its tables and loads the demo data on first boot (`AUTO_INIT=true`).

## 1. Database (free options: TiDB Cloud Serverless, Aiven for MySQL)
Create a MySQL database and note the host, user, password and database name. Some providers require TLS; if the connection is refused for that reason, add `ssl: { rejectUnauthorized: true }` to `server/db/connection.js`.

## 2. Host (Render, Railway, Fly.io: any Docker host)
Deploy this folder using the `Dockerfile`, and set:

| Variable | Value |
| --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | from step 1 |
| `GEMINI_API_KEY` | your key (a new one, not one that was ever in a zip or repo) |
| `ACCESS_CODE` | optional. If set, scanning asks for this code, which protects your Gemini quota. Put the code in the submission notes for judges. |
| `PORT` | usually set by the host |

Open the service URL. `/api/health` should return `{"ok":true}`.

## Local run without Docker
Build the client (`cd client && npm run build`), then `cd server && npm start`. The server serves `client/dist` when it exists.
