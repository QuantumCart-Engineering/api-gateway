import type { NextFunction, Request, RequestHandler, Response } from "express";

import {
    AUTH_SCHEME,
    USER_ID_HEADER
} from "../constants/http";
import { resolveRouteRule } from "../config/routes";
import { AppError } from "../utils/app-error";
import { verifyAccessToken } from "../utils/jwt";

import type { GatewayConfig } from "../types/gateway";

/**
 * Builds the authentication/authorization middleware.
 *
 * The gateway is the single entry point for client traffic, so it:
 *   1. strips any client supplied identity header (`x-user-id`),
 *   2. resolves the route policy for the request,
 *   3. for protected routes verifies the JWT locally and rejects the
 *      request with 401 when it is missing or invalid,
 *   4. injects the verified `x-user-id` downstream when the route
 *      requires it.
 *
 * Verification happens locally using the shared `JWT_SECRET`, so the
 * gateway does not need a round trip to the identity-service on every
 * request.
 */
export const createAuthMiddleware = (
    config: GatewayConfig
): RequestHandler => {
    return (
        req: Request,
        _res: Response,
        next: NextFunction
    ): void => {
        // Never trust a client supplied identity header.
        delete req.headers[USER_ID_HEADER];

        const route = resolveRouteRule(req.method, req.path);

        if (!route || route.auth === "public") {
            next();
            return;
        }

        const header = req.headers.authorization;

        if (typeof header !== "string" || header.trim() === "") {
            next(
                new AppError(
                    "Authentication token is required",
                    401
                )
            );
            return;
        }

        const [scheme, token, ...rest] = header.trim().split(/\s+/);

        if (
            scheme !== AUTH_SCHEME ||
            !token ||
            rest.length > 0
        ) {
            next(
                new AppError(
                    "Invalid authentication header",
                    401
                )
            );
            return;
        }

        let payload;

        try {
            payload = verifyAccessToken(token, {
                secret: config.jwt.secret,
                algorithm: config.jwt.algorithm
            });
        } catch (error) {
            next(error);
            return;
        }

        req.user = payload;

        if (route.injectUserId) {
            req.headers[USER_ID_HEADER] = payload.userId;
        }

        next();
    };
};
