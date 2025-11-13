/* eslint-disable no-unused-vars */
import express, { Express, NextFunction, Request, Response } from "express";
import { validationResult, param, query } from "express-validator";
import { IHealthResponse, getHealth } from "./api/health/health";
import { StatusCode } from "status-code-enum";
import cors from "cors";
import { defaultEpochSeconds } from "./utils";
import {
	initialize,
	authenticateConnection,
	syncToDatabase,
} from "./service/database";
import { keccak256 } from "web3-utils";
import { initializeCache } from "./service/cache";
import { getRPCMeasurements } from "./api/rpc-measurements/getRPCMeasurements";
import { getRPCValidatorMappings } from "./api/rpc-measurements/getRPCValidatorMappings";
import { exportRPCMeasurements } from "./api/rpc-measurements/exportRPCMeasurements";

console.log("Starting RPC Uptime Data API");

process.on("uncaughtException", (err) => {
	console.error("Uncaught Exception:", err.stack);
	process.exit(1); // Optional: Exit the process to avoid undefined states
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	process.exit(1); // Optional: Exit the process to avoid undefined states
});

(async () => {
	if (process.env.NODE_ENV !== "production") {
		require("dotenv").config();
	}
	console.log("Configuring database");
	initialize();
	await authenticateConnection();
	await syncToDatabase(false);
	if (process.env.ENABLE_CACHE === "false") {
		return;
	}
	initializeCache();
})();

const allowedOrigins = process.env.CORS_URLS;
console.log("allowedOrigins", allowedOrigins);

const options: cors.CorsOptions = {
	credentials: true,
	origin: allowedOrigins,
	methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
	allowedHeaders: "Content-Type, Authorization, X-Requested-With",
};

console.log("CORS options", options);

const app: Express = express();

// Parse JSON bodies BEFORE any middleware that accesses req.body
app.use(express.json());
app.use(cors(options));
app.disable("x-powered-by");

// Async error handler
//

const asyncHandler =
	(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
	(req: Request, res: Response, next: NextFunction) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};

// Simple request logging middleware
//
app.use((req, res, next) => {
	const hash = keccak256(
		JSON.stringify({
			route: req.route,
			timestamp: new Date().toISOString(),
			parameters: req.params,
			query: req.query,
			body: req.body,
		})
	);
	console.log(`${hash}: Request started: ${req.method}, ${req.url}`);
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(
			`${hash}: Request ended: ${req.method}, ${req.url}, Duration: ${duration} ms`
		);
	});
	next();
});

export const routes: express.Router = express.Router();
app.use("/", routes);

const port = process.env.PORT || 3006;

// Reusable middleware for route parameter validation
//
const validateNetwork = () => {
	return [
		param("networkName")
			.isIn(["mainnet", "alfajores", "baklava"])
			.withMessage(
				"networkName must be one of mainnet, alfajores, baklava"
			),
		(req: Request, res: Response, next: NextFunction) => {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res
					.status(StatusCode.ClientErrorBadRequest)
					.json({ errors: errors.array() });
			}
			return next();
		},
	] as any[]; // Type assertion to resolve the type mismatch
};

///
/// health
///

routes.get(
	"/:networkName/health",
	validateNetwork(),
	asyncHandler(async (req: Request, res: Response) => {
		const health: IHealthResponse = await getHealth(req.params.networkName);
		res.status(StatusCode.SuccessOK).json(health);
	})
);

//
// rpc measurements
//
const rpcMeasurementsValidators = [
	query("fromEpochSeconds")
		.optional()
		.isInt({ min: defaultEpochSeconds })
		.withMessage(
			`from must be an integer greater than ${defaultEpochSeconds}`
		)
		.toInt(),
	query("toEpochSeconds")
		.optional()
		.isInt({ min: defaultEpochSeconds })
		.isInt({ min: 0 })
		.withMessage(
			`from must be an integer greater than ${defaultEpochSeconds}`
		)
		.toInt(),
	query("filterAddresses")
		.optional()
		.isString()
		.withMessage("optional filterAddresses must be a string"),
];

routes.get(
	"/:networkName/rpcMeasurements",
	validateNetwork(),
	rpcMeasurementsValidators,
	asyncHandler(async (req: Request, res: Response) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(StatusCode.ClientErrorBadRequest)
				.json({ errors: errors.array() });
		}
		const filterArray: string[] = req.query.filterAddresses
			? (req.query.filterAddresses as string).split(",")
			: [];
		const from = parseInt(req.query.fromEpochSeconds as string);
		const to = parseInt(req.query.toEpochSeconds as string);
		const rpcMeasurements = await getRPCMeasurements(
			req.params.networkName,
			from,
			to,
			filterArray
		);
		if (!rpcMeasurements)
			res.status(StatusCode.ClientErrorNotFound).json({
				message: `RPC Measurements not found`,
			});
		else res.status(StatusCode.SuccessOK).json(rpcMeasurements);
	})
);

routes.get(
	"/:networkName/exportRpcMeasurements",
	validateNetwork(),
	rpcMeasurementsValidators,
	asyncHandler(async (req: Request, res: Response) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(StatusCode.ClientErrorBadRequest)
				.json({ errors: errors.array() });
		}
		const filterArray: string[] = req.query.filterAddresses
			? (req.query.filterAddresses as string).split(",")
			: [];
		const from = parseInt(req.query.fromEpochSeconds as string);
		const to = parseInt(req.query.toEpochSeconds as string);
		const rpcMeasurements = await exportRPCMeasurements(
			req.params.networkName,
			from,
			to,
			filterArray
		);
		if (!rpcMeasurements)
			res.status(StatusCode.ClientErrorNotFound).json({
				message: `RPC Measurements not found`,
			});
		else res.status(StatusCode.SuccessOK).json(rpcMeasurements);
	})
);

routes.get(
	"/:networkName/rpcValidators",
	validateNetwork(),
	asyncHandler(async (req: Request, res: Response) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res
				.status(StatusCode.ClientErrorBadRequest)
				.json({ errors: errors.array() });
		}
		const rpcValidators = await getRPCValidatorMappings(
			req.params.networkName
		);
		if (!rpcValidators)
			res.status(StatusCode.ClientErrorNotFound).json({
				message: `RPC Measurements not found`,
			});
		else res.status(StatusCode.SuccessOK).json(rpcValidators);
	})
);

// Generic error handler
//
// eslint-disable-next-line no-unused-vars
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.error(err);
	res.status(StatusCode.ServerErrorInternal).json("Internal server error");
});

app.listen(port, () => console.log(`App listening on PORT ${port}`));
