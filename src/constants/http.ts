/**
 * Hop-by-hop headers (RFC 7230 section 6.1) that must not be forwarded
 * by a proxy. They are meaningful only for a single transport-level
 * connection and must be consumed by the proxy.
 */
export const HOP_BY_HOP_HEADERS: readonly string[] = [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "proxy-connection",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade"
];

/**
 * Client supplied identity header. The gateway derives identity from the
 * verified JWT and must never trust a value supplied directly by a client.
 */
export const USER_ID_HEADER = "x-user-id";

export const REQUEST_ID_HEADER = "x-request-id";

export const AUTH_SCHEME = "Bearer";

export const DEFAULT_SERVICE_HEALTH_PATH = "/health";
