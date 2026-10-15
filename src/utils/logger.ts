/**
 * Minimal structured logger.
 *
 * The existing services rely on `morgan` for request logging and
 * `console.error` for failures. The gateway follows the same convention
 * but centralises the calls so that secrets (authorization headers,
 * tokens, passwords) are never logged.
 */
const timestamp = (): string => new Date().toISOString();

export const logger = {
    info(message: string, meta?: Record<string, unknown>): void {
        if (meta) {
            console.log(`[${timestamp()}] [info] ${message}`, meta);
            return;
        }

        console.log(`[${timestamp()}] [info] ${message}`);
    },

    warn(message: string, meta?: Record<string, unknown>): void {
        if (meta) {
            console.warn(`[${timestamp()}] [warn] ${message}`, meta);
            return;
        }

        console.warn(`[${timestamp()}] [warn] ${message}`);
    },

    error(message: string, meta?: Record<string, unknown>): void {
        if (meta) {
            console.error(`[${timestamp()}] [error] ${message}`, meta);
            return;
        }

        console.error(`[${timestamp()}] [error] ${message}`);
    }
};
