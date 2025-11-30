import { Migration } from "../../umzug";
import { DataTypes } from "sequelize";

export const up: Migration = async (params) => {
	const sequelize = params.context;
	try {
		await sequelize
			.getQueryInterface()
			.addColumn("RPCMeasurement", "isSyncing", {
				type: DataTypes.BOOLEAN(),
				allowNull: true,
			});
	} catch (error: any) {
		// MySQL error code 1060: Duplicate column name
		if (
			error?.original?.code === "ER_DUP_FIELDNAME" ||
			error?.original?.errno === 1060
		) {
			// Column already exists, safely pass
			return;
		}
		// Re-throw if it's a different error
		throw error;
	}
};

export const down: Migration = async (params) => {
	const sequelize = params.context;
	await sequelize
		.getQueryInterface()
		.removeColumn("RPCMeasurement", "isSyncing");
};
