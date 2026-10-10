// First-boot setup for hosted deployments (AUTO_INIT=true): create the tables
// if they are missing and load the demo data if the database is empty.
const fs = require("fs");
const path = require("path");
const db = require("./connection");
const { seedDatabase } = require("./seed");

async function initDatabase() {
    const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8")
        .split("\n")
        .filter(line => !line.trim().startsWith("--"))
        .join("\n");

    for (const statement of sql.split(";").map(s => s.trim()).filter(Boolean)) {
        await db.query(statement);
    }

    const [[{ count }]] = await db.query(
        "SELECT COUNT(*) AS count FROM observations WHERE is_simulated = TRUE"
    );
    if (count === 0) await seedDatabase();
}

module.exports = { initDatabase };
