import type { NextFunction, Request, Response } from "express";

import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { pickRequestId } from "../utils/request-id";
import {
    classifyUpstreamError,
    isUpstreamError
} from "../utils/upstream-error";

/**
 * Terminal error handler for the gateway.
 *
 * Downstream responses are streamed directly to the client by the proxy,
 * so this middleware only runs for errors raised by the gateway itself
 * (validation, auth) or by the proxy layer (unreachable upstream, timeout).
 * Errors are normalised into the envelope:
 *
 *   { "success": false, "error": { "message", "requestId" } }
 */
export const errorMiddleware = (
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (res.headersSent) {
        next(error);
        return;
    }

    const requestId = pickRequestId(req, res);

    let statusCode = 500;
    let message = "Internal server error";

    if (error instanceof AppError) {
        statusCode = error.statusCode;
        message = error.message;
    } else if (isUpstreamError(error)) {
        const info = classifyUpstreamError(error);
        statusCode = info.statusCode;
        message = info.message;

        logger.warn("Upstream request failed", {
            requestId,
            method: req.method,
            path: req.originalUrl,
            statusCode,
            reason: info.message
        });
    } else {
        logger.error("Unhandled gateway error", {
            requestId,
            method: req.method,
            path: req.originalUrl,
            error:
                error instanceof Error
                    ? error.message
                    : String(error)
        });
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            requestId
        }
    });
};
