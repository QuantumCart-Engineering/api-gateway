import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { getGatewayConfig } from "./config/env";
import { createAuthMiddleware } from "./middlewares/auth.middleware";
import { createOriginChecker } from "./middlewares/cors.middleware";
import { errorMiddleware } from "./middlewares/error.middleware";
import { stripHopByHopHeaders } from "./middlewares/header-sanitizer.middleware";
import { notFoundMiddleware } from "./middlewares/not-found.middleware";
import { createRateLimiters } from "./middlewares/rate-limit.middleware";
import { requestIdMiddleware } from "./middlewares/request-id.middleware";
import { createRouter } from "./routes";

import type { Express } from "express";
import type { GatewayConfig } from "./types/gateway";

/**
 * Credential endpoints that receive a stricter rate limit.
 */
const AUTH_RATE_LIMITED_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh"
];

export const createApp = (
    config: GatewayConfig = getGatewayConfig()
): Express => {
    const app = express();

    // The gateway runs behind a load balancer / reverse proxy, so trust the
    // forwarded client address for logging and rate limiting.
    app.set("trust proxy", true);
    app.disable("x-powered-by");

    // Correlation id must be established before anything logs.
    app.use(requestIdMiddleware);

    app.use(helmet());

    app.use(
        cors({
            origin: createOriginChecker(
                config.corsOrigins,
                config.nodeEnv
            ),
            credentials: true,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allowedHeaders: [
                "Content-Type",
                "Authorization",
                "X-Request-Id"
            ],
            exposedHeaders: ["X-Request-Id"]
        })
    );

    app.use(
        morgan(
            ':method :url :status :response-time ms - :res[x-request-id]',
            {
                skip: () => config.nodeEnv === "test"
            }
        )
    );

    const limiters = createRateLimiters(config);

    app.use(limiters.global);
    app.use(AUTH_RATE_LIMITED_PATHS, limiters.auth);

    // Drop transport-level headers before they are forwarded.
    app.use(stripHopByHopHeaders);

    app.use(express.json({ limit: config.bodyLimit }));
    app.use(
        express.urlencoded({
            extended: true,
            limit: config.bodyLimit
        })
    );

    // Authenticate/authorize once, at the edge.
    app.use(createAuthMiddleware(config));

    app.use(createRouter(config));

    app.use(notFoundMiddleware);
    app.use(errorMiddleware);

    return app;
};
