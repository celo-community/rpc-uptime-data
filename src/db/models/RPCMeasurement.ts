import {
	Table,
	Column,
	Model,
	DataType,
	ForeignKey,
	BelongsTo,
	CreatedAt,
	AllowNull,
	Scopes,
} from "sequelize-typescript";
import { Network } from "./Network";
import { Validator } from "./Validator";
import { RPCMeasurementHeader } from "./RPCMeasurementHeader";

@Scopes(() => ({
	default: {
		attributes: {
			exclude: ["createdAt", "updatedAt"],
		},
		include: [],
	},
	full: {
		include: [
			{
				model: Network,
			},
			{
				model: Validator,
			},
			{
				model: RPCMeasurementHeader,
			},
		],
	},
	api: {
		include: [
			{
				model: Validator,
			},
			{
				model: RPCMeasurementHeader,
			},
		],
	},
}))
@Table({
	tableName: "RPCMeasurement",
})
export class RPCMeasurement extends Model {
	@Column({
		type: DataType.INTEGER,
		primaryKey: true,
		autoIncrement: true,
	})
	id: number;

	@AllowNull(false)
	@ForeignKey(() => Network)
	@Column({
		type: DataType.INTEGER,
		allowNull: false,
	})
	networkId: number;

	@AllowNull(false)
	@ForeignKey(() => Validator)
	@Column({
		type: DataType.INTEGER,
		allowNull: false,
	})
	validatorId: number;

	@AllowNull(false)
	@ForeignKey(() => RPCMeasurementHeader)
	@Column({
		type: DataType.BIGINT,
		allowNull: false,
	})
	rpcMeasurementHeaderId: number;

	@AllowNull(false)
	@Column({
		type: DataType.BOOLEAN,
		allowNull: false,
	})
	up: boolean;

	@Column({
		type: DataType.BIGINT,
		allowNull: true,
	})
	blockNumber: number;

	@Column({
		type: DataType.INTEGER,
		allowNull: true,
	})
	statusCode: number;

	@Column({
		type: DataType.BIGINT,
		allowNull: true,
	})
	responseTimeMs: number;

	@Column({
		type: DataType.BOOLEAN,
		allowNull: true,
	})
	isSyncing: boolean;

	@CreatedAt
	@Column
	createdAt: Date;

	@BelongsTo(() => Network)
	network: Network;

	@BelongsTo(() => Validator)
	validator: Validator;

	@BelongsTo(() => RPCMeasurementHeader)
	rpcMeasurementHeader: RPCMeasurementHeader;
}
