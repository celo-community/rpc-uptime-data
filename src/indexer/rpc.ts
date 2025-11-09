import axios from "axios";
import * as utils from "../utils";
import { performance } from "perf_hooks";
import { BlockNumberResponse, IsSyncingResponse } from "./types";

// 	curl -X POST \
//   -H "Content-Type: application/json" \
//   --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
//   https://YOUR_RPC_ENDPOINT

const JSON_RPC_TIMEOUT_MS = parseInt(process.env.JSON_RPC_TIMEOUT_MS || "5000");

export async function getBlockNumberFromRPCEndpoint(
	url: string
): Promise<BlockNumberResponse> {
	const headers = {
		"Content-Type": "application/json",
	};
	const data = {
		jsonrpc: "2.0",
		method: "eth_blockNumber",
		id: 1,
	};

	try {
		const t0 = performance.now();
		const response = await axios.post(url, data, {
			headers,
			timeout: JSON_RPC_TIMEOUT_MS,
		});
		const t1 = performance.now();
		const statusCode = response.status;
		const blockNumber = parseInt(response.data.result, 16);
		const responseTime = t1 - t0;
		return { statusCode, blockNumber, responseTime };
	} catch (error) {
		utils.log("Error making the request: " + error);
		// Extract the actual status code from the error if available
		const statusCode = error.response?.status || 500;
		return { statusCode };
	}
}

export async function getIsSyncingFromRPCEndpoint(
	url: string
): Promise<IsSyncingResponse> {
	const headers = {
		"Content-Type": "application/json",
	};
	const data = {
		jsonrpc: "2.0",
		method: "eth_syncing",
		id: 1,
	};

	try {
		const t0 = performance.now();
		const response = await axios.post(url, data, {
			headers,
			timeout: JSON_RPC_TIMEOUT_MS,
		});
		const t1 = performance.now();
		const statusCode = response.status;
		const isSyncing = Boolean(response.data.result);
		const responseTime = t1 - t0;
		return { statusCode, isSyncing, responseTime };
	} catch (error) {
		utils.log("Error making the request: " + error);
		const statusCode = error.response?.status || 500;
		return { statusCode };
	}
}
