import * as dbService from "../../service/database";
import {
	cacheKeyRPC,
	getFromCache,
	getHashCacheKey,
	setCacheWithExpiry,
} from "../../service/cache";
import { IRPCMeasurementFilter } from "../../utils/types";
import { ApiRPCMeasurement } from "./models/types";
import _ from "lodash";

export async function getRPCMeasurements(
	network: string,
	fromEpochSeconds: number,
	toEpochSeconds: number,
	filterAddresses: string[]
): Promise<ApiRPCMeasurement[]> {
	const defaultTimePeriodInHours = 24;
	const day = defaultTimePeriodInHours * 3600000;

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
	if (toEpochSeconds - fromEpochSeconds > day) {
		fromEpochSeconds = toEpochSeconds - day;
	}
	const filter = {
		fromEpochSeconds: fromEpochSeconds,
		toEpochSeconds: toEpochSeconds,
		addressList: filterAddresses,
	};
	const cacheKey = getHashCacheKey<IRPCMeasurementFilter>(
		cacheKeyRPC,
		filter
	);
	const blocksFromCache = await getFromCache<ApiRPCMeasurement[]>(
		cacheKey,
		network
	);
	if (blocksFromCache) {
		return blocksFromCache;
	}

	const measurements: dbService.RPCMeasurement[] =
		await dbService.getRPCMeasurementByFilter(network, filter, ["api"]);
	if (!measurements) {
		return null;
	}
	const apiMeasurements: ApiRPCMeasurement[] = [];
	const groups = _.uniqBy(
		measurements
			.filter((m) => !!m.rpcMeasurementHeader)
			.map((m) => m.rpcMeasurementHeader),
		"measurementId"
	);
	for (const group of groups) {
		apiMeasurements.push({
			measurementId: group.measurementId,
			executedAt: group.executedAt,
			validators: measurements
				.filter((m) => m.rpcMeasurementHeaderId === group.id)
				.map((g) => ({
					validatorAddress: g.validator?.address,
					up: g.up,
					blockNumber: g.blockNumber,
					responseTimeMs: g.responseTimeMs,
					statusCode: g.statusCode,
					isSyncing: g.isSyncing,
				})),
		});
	}

	// This could be close to measurement window
	let ttl = 5;
	await setCacheWithExpiry<ApiRPCMeasurement[]>(
		cacheKey,
		apiMeasurements,
		ttl,
		network
	);
	return apiMeasurements;
}
