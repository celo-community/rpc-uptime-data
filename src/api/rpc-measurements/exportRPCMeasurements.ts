import * as dbService from "../../service/database";
import { ApiRPCMeasurementExport, flattenMeasurement } from "./models/types";

export async function exportRPCMeasurements(
	network: string,
	fromEpochSeconds: number,
	toEpochSeconds: number,
	filterAddresses: string[]
): Promise<ApiRPCMeasurementExport[]> {
	const defaultTimePeriodInHours = 24;
	const day = defaultTimePeriodInHours * 3600000;
	const year = defaultTimePeriodInHours * 3600000 * 365;

	if (!fromEpochSeconds && !toEpochSeconds) {
		const now = new Date();
		toEpochSeconds = new Date().getTime();
		now.setHours(now.getHours() - defaultTimePeriodInHours);
		fromEpochSeconds = now.getTime();
	}
	if (!fromEpochSeconds) {
		fromEpochSeconds = toEpochSeconds - day;
	}
	if (!toEpochSeconds) {
		toEpochSeconds = fromEpochSeconds + day;
	}
	if (toEpochSeconds <= fromEpochSeconds) {
		throw new Error(`from date should be less than to date.`);
	}
	if (toEpochSeconds - fromEpochSeconds > year) {
		fromEpochSeconds = toEpochSeconds - year;
	}
	const filter = {
		fromEpochSeconds: fromEpochSeconds,
		toEpochSeconds: toEpochSeconds,
		addressList: filterAddresses,
	};

	const measurements: dbService.RPCMeasurement[] =
		await dbService.getRPCMeasurementByFilter(network, filter, ["api"]);
	if (!measurements) {
		return null;
	}
	const apiMeasurements: ApiRPCMeasurementExport[] =
		measurements.map(flattenMeasurement);
	return apiMeasurements;
}
