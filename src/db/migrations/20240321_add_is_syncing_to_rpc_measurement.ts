import { QueryInterface, DataTypes } from "sequelize";

export async function up(queryInterface: QueryInterface) {
	await queryInterface.addColumn("RPCMeasurement", "isSyncing", {
		type: DataTypes.BOOLEAN,
		allowNull: true,
	});
}

export async function down(queryInterface: QueryInterface) {
	await queryInterface.removeColumn("RPCMeasurement", "isSyncing");
}
