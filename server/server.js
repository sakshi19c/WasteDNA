const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");

const fs = require("fs");
const analyzeRoute = require("./routes/analyze");
const dashboardRoute = require("./routes/dashboard");

const app = express();

app.set("trust proxy", 1);
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? true }));
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/analyze", analyzeRoute);
app.use("/api/dashboard", dashboardRoute);

app.use("/api", (req, res) => res.status(404).json({ error: "not_found", message: "No such endpoint." }));

// In production one service serves both the API and the built client.
const clientDist = path.resolve(__dirname, "../client/dist");
if (!fs.existsSync(clientDist)) {
    app.get("/", (req, res) => res.json({ message: "WasteDNA backend is running" }));
} else {
    app.use(express.static(clientDist));
    app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, "index.html")));
}

const PORT = process.env.PORT || 5000;

async function start() {
    if (process.env.AUTO_INIT === "true") {
        const { initDatabase } = require("./db/init");
        await initDatabase();
        console.log("Database ready.");
    }
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start().catch(error => {
    console.error("Startup failed:", error.message);
    process.exit(1);
});
