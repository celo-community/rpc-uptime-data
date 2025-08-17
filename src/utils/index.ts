import { performance } from "perf_hooks";
import { promisify } from "util";
import { exec, ExecOptions } from "child_process";

export const defaultEpochSeconds = 946684800; // is time of (2000, 1, 1)

export function titleCaseWord(word: string): string {
	if (!word) return word;
	return word[0].toUpperCase() + word.substring(1).toLowerCase();
}

export function logTimeElapsed(t0: number, prefix: string) {
	const t1 = performance.now();
	console.log(`TimeSpan ${prefix} ${t1 - t0} ms`);
}

export function sleep(ms: number): Promise<unknown> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function millisecondsForHumans(milliseconds: number): string {
	const seconds: number = Math.floor(milliseconds / 1000);

	const levels: [number, string][] = [
		[Math.floor(seconds / 31536000), "years"],
		[Math.floor((seconds % 31536000) / 86400), "days"],
		[Math.floor(((seconds % 31536000) % 86400) / 3600), "hours"],
		[Math.floor((((seconds % 31536000) % 86400) % 3600) / 60), "minutes"],
		[(((seconds % 31536000) % 86400) % 3600) % 60, "seconds"],
	];
	let returntext = "";

	for (let i = 0, max = levels.length; i < max; i++) {
		if (levels[i][0] === 0) continue;
		returntext +=
			" " +
			levels[i][0] +
			" " +
			(levels[i][0] === 1
				? levels[i][1].substr(0, levels[i][1].length - 1)
				: levels[i][1]);
	}
	return returntext.trim();
}

export function encodeBase64(data: string) {
	return Buffer.from(data ? data : "", "utf8").toString("base64");
}
export function decodeBase64(data: string) {
	return data ? Buffer.from(data, "base64").toString("utf8") : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function log(args: any): void {
	if (process.env.DEBUG?.toLowerCase() === "true") console.log(args);
}

export function pp(obj: unknown): string {
	return JSON.stringify(obj, null, 2);
}

export function cleanInt(x: string) {
	const data = Number(x);
	return data >= 0 ? Math.floor(data) : Math.ceil(data);
}

interface ExecWithRetryOptions {
	timeout?: number;
	maxRetries?: number;
	baseDelay?: number;
	maxDelay?: number;
	backoffMultiplier?: number;
	// eslint-disable-next-line no-unused-vars
	onRetry?: (attempt: number, error: Error, delay: number) => void;
}

interface ExecResult {
	stdout: string;
	stderr: string;
}

/**
 * Executes a command with timeout and exponential backoff retry functionality
 * @param command - The command to execute
 * @param options - Execution options including timeout and retry settings
 * @param execOptions - Child process exec options
 * @returns Promise with stdout and stderr
 *
 * @example
 * // Basic usage with default settings (30s timeout, 3 retries)
 * const result = await execAsyncWithRetry('ls -la');
 *
 * @example
 * // Custom timeout and retry settings
 * const result = await execAsyncWithRetry('long-running-command', {
 *   timeout: 120000, // 2 minutes
 *   maxRetries: 5,
 *   baseDelay: 5000, // 5 seconds
 *   maxDelay: 60000, // 1 minute max delay
 * });
 *
 * @example
 * // With custom retry callback for logging
 * const result = await execAsyncWithRetry('celocli command', {
 *   timeout: 60000,
 *   maxRetries: 3,
 *   onRetry: (attempt, error, delay) => {
 *     console.log(`Attempt ${attempt} failed: ${error.message}, retrying in ${delay}ms`);
 *   }
 * });
 */
export async function execAsyncWithRetry(
	command: string,
	options: ExecWithRetryOptions = {},
	execOptions: ExecOptions = {}
): Promise<ExecResult> {
	const {
		timeout = 30000, // 30 seconds default timeout
		maxRetries = 3,
		baseDelay = 1000, // 1 second base delay
		maxDelay = 30000, // 30 seconds max delay
		backoffMultiplier = 2,
		onRetry = (attempt, error, delay) => {
			log(
				`Retry attempt ${attempt} after ${delay}ms due to: ${error.message}`
			);
		},
	} = options;

	let lastError: Error;

	for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
		try {
			// Create a promise that rejects after timeout
			const timeoutPromise = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(
						new Error(
							`Command timed out after ${timeout}ms: ${command}`
						)
					);
				}, timeout);
			});

			// Execute the command with timeout
			const execPromise = promisify(exec)(command, execOptions);
			const result = await Promise.race([execPromise, timeoutPromise]);

			return result;
		} catch (error) {
			lastError = error as Error;

			// If this was the last attempt, throw the error
			if (attempt > maxRetries) {
				throw new Error(
					`Command failed after ${
						maxRetries + 1
					} attempts. Last error: ${lastError.message}`
				);
			}

			// Calculate delay with exponential backoff
			const delay = Math.min(
				baseDelay * Math.pow(backoffMultiplier, attempt - 1),
				maxDelay
			);

			// Call retry callback
			onRetry(attempt, lastError, delay);

			// Wait before retrying
			await sleep(delay);
		}
	}

	// This should never be reached, but TypeScript requires it
	throw lastError!;
}
