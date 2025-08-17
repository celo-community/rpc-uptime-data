import { Migration } from "../../umzug";
import { DataTypes } from "sequelize";

export const up: Migration = async (params) => {
	const sequelize = params.context;
	await sequelize
		.getQueryInterface()
		.addColumn("RPCMeasurement", "isSyncing", {
			type: DataTypes.BOOLEAN(),
			allowNull: true,
		});
};

export const down: Migration = async (params) => {
	const sequelize = params.context;
	await sequelize
		.getQueryInterface()
		.removeColumn("RPCMeasurement", "isSyncing");
};
