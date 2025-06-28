import { config } from "dotenv-flow";
config();
import { Umzug } from "umzug/lib/umzug";
import { SequelizeStorage } from "umzug/lib/storage/sequelize";
import { Sequelize } from "sequelize";
import { initialize, initializeMemory } from "./service/database";

let sequelize: Sequelize;

if (process.env.NODE_ENV === "production") {
	sequelize = initialize();
} else {
	sequelize = initializeMemory();
}

process.env.QUERY_LOGGING = "true";

export const migrator = new Umzug({
	migrations: {
		glob: ["db/migrations/*.js", { cwd: __dirname }],
	},
	context: sequelize,
	storage: new SequelizeStorage({
		sequelize,
	}),
	logger: console,
});

export type Migration = typeof migrator._types.migration;
