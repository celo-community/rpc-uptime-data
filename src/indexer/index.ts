import * as dbService from "../service/database";
import * as utils from "../utils";
import * as blockchainService from "../service/blockchain";

import { performance } from "perf_hooks";
import { Sequelize } from "sequelize-typescript";
import { v4 as uuidv4 } from "uuid";
import { ContractKit, newKit } from "@celo/contractkit";
import { Transaction } from "sequelize";
import { IRPCInfo, IElectedValidator, IValidatorGroup } from "./types";
import {
	getBlockNumberFromRPCEndpoint,
	getIsSyncingFromRPCEndpoint,
} from "./rpc";
import { updateValidatorNames, updateValidatorGroups } from "./validator";

const NODE_URL = process.env.NODE_URL;
const EXTERNAL_NODE_URL = process.env.EXTERNAL_NODE_URL;
const RPC_TIMER_MS = parseInt(process.env.RPC_TIMER_MS || "300000");

let sequelize: Sequelize;
let kit: ContractKit;

async function getCurrentElectedValidators(
	nodeURL = NODE_URL
): Promise<IElectedValidator[]> {
	try {
		utils.log(
			`getting current elected validators: ${new Date()} from ${nodeURL}`
		);
		const { stdout } = await utils.execAsyncWithRetry(
			`NO_SYNCCHECK=1 npx celocli election:current --output json --node ${nodeURL}`,
			{
				timeout: 60000, // 60 seconds for this command
				maxRetries: 3,
				baseDelay: 2000, // 2 seconds base delay
				maxDelay: 30000, // 30 seconds max delay
			}
		);
		//utils.log(`Raw stdout: ${stdout}`);

		// Find the closing bracket of the JSON array because MOTD is included in the output
		const endBracketIndex = stdout.lastIndexOf("]");
		if (endBracketIndex === -1) {
			throw new Error("No closing bracket found in output");
		}

		// Extract just the JSON part (from beginning to the closing bracket)
		const jsonStr = stdout.substring(0, endBracketIndex + 1);
		//utils.log(`Extracted JSON: ${jsonStr}`);

		const parsed: IElectedValidator[] = JSON.parse(jsonStr);
		utils.log(`Parsed ${parsed.length} elected validators:`);
		return parsed;
	} catch (error) {
		utils.log(
			`Error getting current elected validators: ${error} from ${nodeURL}`
		);
		if (nodeURL === NODE_URL) {
			return getCurrentElectedValidators(EXTERNAL_NODE_URL);
		}
		throw error;
	}
}

async function getRPCList(nodeURL = NODE_URL): Promise<IRPCInfo[]> {
	try {
		utils.log(`getting RPC list: ${new Date()} from ${nodeURL}`);
		const { stdout } = await utils.execAsyncWithRetry(
			`NO_SYNCCHECK=1 npx celocli validatorgroup:rpc-urls --output json --node ${nodeURL}`,
			{
				timeout: 60000, // 60 seconds for this command
				maxRetries: 3,
				baseDelay: 2000, // 2 seconds base delay
				maxDelay: 30000, // 30 seconds max delay
			}
		);
		//utils.log(`Raw stdout: ${stdout}`);

		// Find the closing bracket of the JSON array because MOTD is included in the output
		const endBracketIndex = stdout.lastIndexOf("]");
		if (endBracketIndex === -1) {
			throw new Error("No closing bracket found in output");
		}

		// Extract just the JSON part (from beginning to the closing bracket)
		const jsonStr = stdout.substring(0, endBracketIndex + 1);
		//utils.log(`Extracted JSON: ${jsonStr}`);

		const parsed: IRPCInfo[] = JSON.parse(jsonStr);
		utils.log(`Parsed ${parsed.length} RPC entries`);
		return parsed;
	} catch (error) {
		utils.log(`Error getting RPC list: ${error} from ${nodeURL}`);
		if (nodeURL === NODE_URL) {
			return getRPCList(EXTERNAL_NODE_URL);
		}
		throw error;
	}
}

async function getValidatorGroups(
	nodeURL = NODE_URL
): Promise<IValidatorGroup[]> {
	try {
		utils.log(`getting validator groups: ${new Date()} from ${nodeURL}`);
		const { stdout } = await utils.execAsyncWithRetry(
			`NO_SYNCCHECK=1 npx celocli validatorgroup:list --output json --node ${nodeURL}`,
			{
				timeout: 60000, // 60 seconds for this command
				maxRetries: 3,
				baseDelay: 2000, // 2 seconds base delay
				maxDelay: 30000, // 30 seconds max delay
			}
		);
		//utils.log(`Raw stdout: ${stdout}`);

		// Find the closing bracket of the JSON array because MOTD is included in the output
		const endBracketIndex = stdout.lastIndexOf("]");
		if (endBracketIndex === -1) {
			throw new Error("No closing bracket found in output");
		}

		// Extract just the JSON part (from beginning to the closing bracket)
		const jsonStr = stdout.substring(0, endBracketIndex + 1);
		//utils.log(`Extracted JSON: ${jsonStr}`);

		const parsed: IValidatorGroup[] = JSON.parse(jsonStr);
		utils.log(`Parsed ${parsed.length} validator groups`);
		return parsed;
	} catch (error) {
		utils.log(`Error getting validator groups: ${error} from ${nodeURL}`);
		if (nodeURL === NODE_URL) {
			return getValidatorGroups(EXTERNAL_NODE_URL);
		}
		throw error;
	}
}

async function checkRPCEndpoint(
	rpcUrl: string,
	measurement: dbService.RPCMeasurement
): Promise<{ up: boolean; blockNumber?: number }> {
	let t0 = performance.now();
	try {
		utils.log(`checking rpc ${rpcUrl}...`);
		const response = await getBlockNumberFromRPCEndpoint(rpcUrl);
		measurement.statusCode = response?.statusCode;
		if (response.blockNumber) {
			measurement.up = true;
			measurement.blockNumber = response.blockNumber;
			measurement.responseTimeMs = response.responseTime;
		}
	} catch (error) {
		utils.log(`Error checking block number ${rpcUrl}: ${error}`);
	}
	utils.logTimeElapsed(t0, `checked block number ${rpcUrl}`);

	t0 = performance.now();
	measurement.isSyncing = null;
	try {
		const response = await getIsSyncingFromRPCEndpoint(rpcUrl);
		measurement.isSyncing = response?.isSyncing;
	} catch (error) {
		utils.log(`Error checking is syncing ${rpcUrl}: ${error}`);
	}
	utils.logTimeElapsed(t0, `checked is syncing ${rpcUrl}`);
	return measurement;
}

async function updateValidatorRPC(
	network: dbService.Network,
	validators: dbService.Validator[],
	measurementHeaderId: number,
	transaction: Transaction
): Promise<void> {
	if (!validators || validators.length < 1) {
		utils.log("No validators to updateValidatorRPC");
		return;
	}
	utils.log(`Updating ${validators?.length} validators RPCs...`);
	for (const validator of validators) {
		const latestValidatorRPC = await dbService.ValidatorRPC.findOne({
			where: {
				validatorId: validator.id,
				networkId: network.id,
			},
			order: [["rpcMeasurementHeaderId", "DESC"]],
			limit: 1,
		});
		if (latestValidatorRPC) {
			if (latestValidatorRPC.rpcUrl === (validator.rpcUrl || "None")) {
				utils.log(
					`Validator ${validator.id} already has a RPC measurement header id ${latestValidatorRPC.rpcMeasurementHeaderId} and rpcUrl ${validator.rpcUrl}`
				);
				continue;
			} else {
				utils.log(
					`Validator ${validator.id} has changed their rpcUrl from ${latestValidatorRPC.rpcUrl} to ${validator.rpcUrl}`
				);
				await dbService.ValidatorRPC.create(
					{
						validatorId: validator.id,
						networkId: network.id,
						rpcMeasurementHeaderId: measurementHeaderId,
						rpcUrl: validator.rpcUrl || "None",
					},
					{ transaction: transaction }
				);
			}
		} else {
			utils.log(
				`Validator ${validator.id} does not have a RPC record yet`
			);
			await dbService.ValidatorRPC.create(
				{
					validatorId: validator.id,
					networkId: network.id,
					rpcMeasurementHeaderId: measurementHeaderId,
					rpcUrl: validator.rpcUrl || "None",
				},
				{ transaction: transaction }
			);
		}
	}
}

async function monitorRPCsAndUpdate(
	network: dbService.Network,
	measurementId: string,
	electedValidators: dbService.Validator[]
): Promise<dbService.RPCMeasurement[]> {
	const t0 = performance.now();
	utils.log(`Starting RPC monitoring...`);
	const executedAt = new Date();
	const monitoringResults: dbService.RPCMeasurement[] = [];
	const promises = [];
	if (!electedValidators) {
		utils.log("No validators to monitorRPCs");
		return;
	}
	for (const validator of electedValidators) {
		const measurement = dbService.RPCMeasurement.build({
			networkId: network.id,
			validatorId: validator.id,
		});
		if (!validator.rpcUrl) {
			measurement.up = false;
			monitoringResults.push(measurement);
			continue;
		}
		promises.push(checkRPCEndpoint(validator.rpcUrl, measurement));
		monitoringResults.push(measurement);
	}

	await Promise.all(promises)
		// eslint-disable-next-line no-unused-vars
		.then((_result) => {
			utils.log("All promises have been resolved");
		})
		.catch((error) => {
			utils.log(`At least any one promise is rejected: ${error}`);
		});

	await sequelize.transaction(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
		async (_rpcTransaction: any) => {
			const measurementHeader =
				await dbService.RPCMeasurementHeader.create(
					{
						networkId: network.id,
						executedAt: executedAt,
						measurementId: measurementId,
					},
					{ transaction: _rpcTransaction }
				);
			monitoringResults.forEach(
				(m) => (m.rpcMeasurementHeaderId = measurementHeader.id)
			);
			await dbService.bulkInsertRPCMeasurement(
				monitoringResults,
				_rpcTransaction
			);
			await updateValidatorRPC(
				network,
				electedValidators,
				measurementHeader.id,
				_rpcTransaction
			);
		}
	);

	utils.logTimeElapsed(t0, "monitorRPCsAndUpdate()");
	return monitoringResults;
}

async function insertNewValidators(
	network: dbService.Network,
	validators: IElectedValidator[]
): Promise<void> {
	const t0 = performance.now();
	utils.log(`Start insertNewValidators()...`);
	const validatorsToInsert: dbService.Validator[] = [];

	for (let i = 0; i < validators?.length; i++) {
		validatorsToInsert.push(
			dbService.Validator.build({
				address: validators[i].address,
				networkId: network.id,
			})
		);
	}
	await dbService.bulkInsertValidators(validatorsToInsert);
	utils.logTimeElapsed(t0, `Inserted ${validators.length} validators`);
}

async function insertNewValidatorGroups(
	network: dbService.Network,
	validatorGroups: IValidatorGroup[]
): Promise<void> {
	const t0 = performance.now();
	utils.log(`Inserting new validator groups ${utils.pp(validatorGroups)}`);
	const validatorGroupsToInsert: dbService.ValidatorGroup[] = [];
	for (const validatorGroup of validatorGroups) {
		validatorGroupsToInsert.push(
			dbService.ValidatorGroup.build({
				networkId: network.id,
				address: validatorGroup.address,
				name: validatorGroup.name,
			})
		);
	}
	await dbService.bulkInsertValidatorGroups(validatorGroupsToInsert);
	utils.logTimeElapsed(
		t0,
		`Inserted ${validatorGroupsToInsert.length} validator groups`
	);
}

async function processValidatorsAndGroups(
	network: dbService.Network,
	kit: ContractKit
): Promise<void> {
	const t0 = performance.now();
	const blockNumber = await blockchainService.getBlockNumber(kit);

	// Process validator groups
	const cliValidatorGroups: IValidatorGroup[] = await getValidatorGroups();
	const dbValidatorGroups: dbService.ValidatorGroup[] =
		await dbService.ValidatorGroup.findAll({
			where: {
				networkId: network.id,
			},
		});
	const validatorGroupsToInsert: IValidatorGroup[] = [];
	for (const cliValidatorGroup of cliValidatorGroups) {
		const dbValidatorGroup = dbValidatorGroups.find(
			(g) => g.address === cliValidatorGroup.address
		);
		if (!dbValidatorGroup) {
			validatorGroupsToInsert.push(cliValidatorGroup);
			utils.log(
				`Inserting new validator group ${cliValidatorGroup.name} ${cliValidatorGroup.address}`
			);
		} else {
			utils.log(
				`Validator group ${cliValidatorGroup.name} ${cliValidatorGroup.address} already exists`
			);
			if (cliValidatorGroup.name !== dbValidatorGroup.name) {
				utils.log(
					`Updating validator group ${cliValidatorGroup.address} name from ${dbValidatorGroup.name} to ${cliValidatorGroup.name}`
				);
				dbValidatorGroup.name = cliValidatorGroup.name;
				await dbValidatorGroup.save();
			}
		}
	}
	if (validatorGroupsToInsert?.length > 0) {
		await insertNewValidatorGroups(network, validatorGroupsToInsert);
	}

	// Process validators
	const cliValidators: IElectedValidator[] =
		await getCurrentElectedValidators();
	const dbValidators: dbService.Validator[] =
		await dbService.Validator.findAll({
			where: { networkId: network.id },
		});
	const validatorsToInsert: IElectedValidator[] = [];
	let processNames = false;
	for (const cliValidator of cliValidators) {
		const dbValidator = dbValidators.find(
			(v) => v.address === cliValidator.address
		);
		if (!dbValidator) {
			validatorsToInsert.push(cliValidator);
			utils.log(
				`Inserting new validator ${cliValidator.name} ${cliValidator.address}`
			);
		} else {
			utils.log(
				`Validator ${cliValidator.name} ${cliValidator.address} already exists`
			);
			const validatorName: dbService.ValidatorName =
				await dbService.getValidatorNameAtBlock(
					network.networkName,
					dbValidator.id,
					blockNumber
				);
			if (
				!validatorName ||
				cliValidator.name !== validatorName.validatorName
			) {
				utils.log(
					`Validator ${cliValidator.name} ${cliValidator.address} has a different name in the database: ${validatorName?.validatorName}, we will perform bulk name updates`
				);
				processNames = true;
			}
		}
	}
	if (validatorsToInsert?.length > 0) {
		await insertNewValidators(network, validatorsToInsert);
	}

	if (
		validatorsToInsert?.length > 0 ||
		processNames ||
		validatorGroupsToInsert?.length > 0
	) {
		utils.log(
			`Updating validator names and groups at block ${blockNumber}`
		);
		await updateValidatorNames(blockNumber, network, kit);
		await updateValidatorGroups(network, kit);
	} else {
		utils.log(
			`Skipping validator names and groups update at block ${blockNumber} for performance reasons`
		);
	}
	utils.logTimeElapsed(t0, `Processed validators and groups`);
}

async function runRPCIndexer(): Promise<void> {
	try {
		utils.log(`RPC indexer initialize...`);
		sequelize = dbService.initialize();
		await dbService.authenticateConnection();
		await dbService.syncToDatabase(false);
		kit = newKit(NODE_URL);
		const network: dbService.Network = await dbService.getOrInsertNetwork(
			process.env.NETWORK_ID
		);

		const MIGRATION_BLOCK = parseInt(process.env.MIGRATION_BLOCK || "0");
		if (MIGRATION_BLOCK == 0) {
			throw new Error("MIGRATION_BLOCK is not set");
		}

		let blockNumber = await blockchainService.getBlockNumber(kit);
		while (blockNumber < MIGRATION_BLOCK) {
			utils.log(
				`Current block ${blockNumber} is before migration block ${MIGRATION_BLOCK}, waiting for L2 migration...`
			);
			await utils.sleep(5000);
			blockNumber = await blockchainService.getBlockNumber(kit);
		}

		// eslint-disable-next-line no-constant-condition
		while (true) {
			await processValidatorsAndGroups(network, kit);
			const rpcList: IRPCInfo[] = await getRPCList(NODE_URL);
			let matchingValidators: dbService.Validator[] =
				await dbService.getValidatorByAddressList(
					network.networkName,
					rpcList.map((r) => r.validatorAddress)
				);
			for (const validator of matchingValidators) {
				const rpcInfo = rpcList.find(
					(r) => r.validatorAddress === validator.address
				);
				if (rpcInfo) {
					validator.rpcUrl = rpcInfo.rpcUrl;
					await validator.save();
				}
			}
			const electedValidators: IElectedValidator[] =
				await getCurrentElectedValidators(NODE_URL);
			const electedValidatorsAddresses: string[] = electedValidators.map(
				(v) => v.address
			);
			const dbElectedValidators: dbService.Validator[] =
				await dbService.getValidatorByAddressList(
					network.networkName,
					electedValidatorsAddresses
				);
			const measurementId = uuidv4();
			await monitorRPCsAndUpdate(
				network,
				measurementId,
				dbElectedValidators
			);

			// Calculate time until next 5-minute interval
			const now = Date.now();
			const nextInterval = Math.ceil(now / RPC_TIMER_MS) * RPC_TIMER_MS;
			const sleepTime = nextInterval - now;

			utils.log(
				`Completed monitoring cycle for ${network.networkName}, measurementId: ${measurementId}, waiting ${sleepTime}ms until next interval...`
			);
			await utils.sleep(sleepTime);
		}
	} catch (err) {
		console.error(err);
		process.exit(1);
	}
}

if (require.main === module) {
	runRPCIndexer(); // This only runs when this file is the main entry point
}
