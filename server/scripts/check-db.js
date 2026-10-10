require("dotenv").config({
    path: require("path").resolve(__dirname, "../../.env")
});

const db = require("../db/connection");

async function testDatabase() {
    try {
        const [rows] = await db.query("SELECT DATABASE() AS database_name");

        console.log("MySQL connection successful!");
        console.log("Connected database:", rows[0].database_name);

        process.exit(0);
    } catch (error) {
        console.error("MySQL connection failed:");
        console.error(error.message);

        process.exit(1);
    }
}

testDatabase();
