import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { REQUEST_ID_HEADER } from "../constants/http";

/**
 * Ensures every request has a correlation id.
 *
 * - A caller supplied `x-request-id` is preserved.
 * - Otherwise a new UUID is generated.
 *
 * The id is stored on `req.id`, set as a response header and forwarded
 * downstream so a request can be traced across services.
 */
export const requestIdMiddleware = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const incoming = req.headers[REQUEST_ID_HEADER];

    const requestId =
        typeof incoming === "string" && incoming.trim().length > 0
            ? incoming.trim()
            : randomUUID();

    req.id = requestId;
    req.headers[REQUEST_ID_HEADER] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
};
