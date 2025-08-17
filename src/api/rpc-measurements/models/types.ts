import _ from "lodash";
import { RPCMeasurement, Validator } from "src/db";

export interface ApiRPCMeasurement {
	measurementId: string;
	executedAt: Date;
	validators: ApiValidatorMeasurement[];
}

export interface ApiRPCMeasurementExport {
	measurementId: string;
	timestamp: Date;
	validatorAddress: string;
	responseTimeMs: number;
	blockNumber: number;
	up: boolean;
	statusCode: number;
	isSyncing: boolean;
}

export interface ApiValidatorMeasurement {
	validatorAddress: string;
	up: boolean;
	blockNumber: number;
	responseTimeMs: number;
	statusCode: number;
	isSyncing: boolean;
}

export interface ApiValidator {
	address: string;
	validatorName: string;
	validatorGroup: string;
	rpcUrl?: string;
}

export function flattenValidator(validator: Validator): ApiValidator {
	if (!validator) return null;
	const name = _.maxBy(validator?.validatorNames, "id");
	const group = _.maxBy(validator?.validatorGroupValidators, "id");
	return {
		address: validator?.address,
		validatorName: name?.validatorName,
		validatorGroup: group?.validatorGroup?.name,
		rpcUrl: validator.rpcUrl,
	};
}

export function flattenMeasurement(
	measurement: RPCMeasurement
): ApiRPCMeasurementExport {
	if (!measurement) return null;
	return {
		measurementId: measurement.rpcMeasurementHeader?.measurementId,
		timestamp: measurement.rpcMeasurementHeader?.executedAt,
		blockNumber: measurement.blockNumber,
		validatorAddress: measurement.validator?.address,
		responseTimeMs: measurement.responseTimeMs,
		up: measurement.up,
		statusCode: measurement.statusCode,
		isSyncing: measurement.isSyncing,
	};
}
