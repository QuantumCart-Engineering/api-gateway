import rateLimit from "express-rate-limit";
import type { Request, RequestHandler, Response } from "express";

import { getRequestId } from "../utils/request-id";

import type { GatewayConfig } from "../types/gateway";

export interface RateLimiters {
    global: RequestHandler;
    auth: RequestHandler;
}

const handler = (
    _req: Request,
    res: Response
): void => {
    res.status(429).json({
        success: false,
        error: {
            message: "Too many requests, please try again later",
            requestId: getRequestId(res.req.headers)
        }
    });
};

const noop: RequestHandler = (_req, _res, next) => next();

/**
 * Builds the rate limiters applied to the gateway.
 *
 * - `global` covers every route.
 * - `auth` is a stricter limiter for credential endpoints (login,
 *   register, refresh) to slow down brute force attempts.
 *
 * When `RATE_LIMIT_ENABLED` is false both limiters become pass-through,
 * which is convenient for local development and integration tests.
 */
export const createRateLimiters = (
    config: GatewayConfig
): RateLimiters => {
    if (!config.rateLimit.enabled) {
        return { global: noop, auth: noop };
    }

    const common = {
        standardHeaders: "draft-7" as const,
        legacyHeaders: false,
        handler,
        // The gateway is typically deployed behind a load balancer, so the
        // X-Forwarded-For validation is disabled to avoid false warnings.
        validate: {
            xForwardedForHeader: false,
            trustProxy: false
        }
    };

    const global = rateLimit({
        ...common,
        windowMs: config.rateLimit.windowMs,
        limit: config.rateLimit.max
    });

    const auth = rateLimit({
        ...common,
        windowMs: config.rateLimit.windowMs,
        limit: config.rateLimit.authMax
    });

    return { global, auth };
};
