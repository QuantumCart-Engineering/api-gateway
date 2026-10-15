import type { Request, Response } from "express";

import { pickRequestId } from "../utils/request-id";

/**
 * Catch-all handler for paths that do not match a gateway route.
 *
 * Returning a JSON envelope (instead of Express' default HTML 404) keeps
 * the gateway API consistent for all clients.
 */
export const notFoundMiddleware = (
    req: Request,
    res: Response
): void => {
    res.status(404).json({
        success: false,
        error: {
            message: `Route ${req.method} ${req.originalUrl} not found`,
            requestId: pickRequestId(req, res)
        }
    });
};
