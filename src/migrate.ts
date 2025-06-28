import { migrator } from "./umzug";
import * as dbService from "./service/database";
import * as utils from "./utils";

/**
 * Run database migrations
 */
async function runMigrations() {
	try {
		utils.log("Starting database migrations...");

		// Initialize database connection
		dbService.initialize();
		utils.log("Database connection initialized");

		// Authenticate connection
		await dbService.authenticateConnection();
		utils.log("Database connection authenticated");

		// Run migrations
		utils.log("Running Umzug migrations...");
		await migrator.up();
		utils.log("Database migrations completed successfully");

		// Close database connection
		await dbService.closeDatabase();
		utils.log("Migration process completed successfully");

		process.exit(0);
	} catch (error) {
		utils.log(`Error during migration: ${error}`);
		process.exit(1);
	}
}

// Run the migrations
runMigrations();
