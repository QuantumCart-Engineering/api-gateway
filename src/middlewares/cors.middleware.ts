/**
 * CORS origin policy for the gateway.
 *
 * `isOriginAllowed` is a small, dependency free helper so tests can assert
 * the exact behaviour. The actual `cors` middleware in `app.ts` is wired
 * up using `createOriginChecker`.
 */
export const isOriginAllowed = (
    origin: string | undefined,
    allowedOrigins: string[],
    nodeEnv: string
): boolean => {
    // Non-browser clients (curl, server-to-server) send no Origin.
    if (!origin) {
        return true;
    }

    if (allowedOrigins.includes(origin)) {
        return true;
    }

    // In non-production environments, allow any origin for convenience.
    return nodeEnv !== "production";
};

export type OriginCallback = (
    origin: string | undefined,
    callback: (error: Error | null, allowed?: boolean) => void
) => void;

export const createOriginChecker = (
    allowedOrigins: string[],
    nodeEnv: string
): OriginCallback => {
    return (origin, callback) => {
        // Deny by omitting the CORS headers rather than raising, so the
        // browser blocks the response without turning a policy decision
        // into a 500 from the error handler.
        callback(
            null,
            isOriginAllowed(origin, allowedOrigins, nodeEnv)
        );
    };
};
