import * as dbService from "./service/database";
import * as utils from "./utils";

/**
 * Database initialization script
 * This script initializes the database connection and creates Sequelize models
 */
async function initializeDatabase() {
	try {
		utils.log("Starting database initialization...");

		// Initialize database connection
		dbService.initialize();
		utils.log("Database connection initialized");

		// Authenticate connection
		await dbService.authenticateConnection();
		utils.log("Database connection authenticated");

		// Sync database models (create tables if they don't exist)
		utils.log("Creating database models...");
		await dbService.syncToDatabase(false);
		utils.log("Database models created successfully");

		// Close database connection
		await dbService.closeDatabase();
		utils.log("Database initialization completed successfully");

		process.exit(0);
	} catch (error) {
		utils.log(`Error during database initialization: ${error}`);
		process.exit(1);
	}
}

// Run the initialization
initializeDatabase();
