import type { NextFunction, Request, Response } from "express";

import { HOP_BY_HOP_HEADERS } from "../constants/http";

/**
 * Removes hop-by-hop headers before a request is forwarded downstream.
 *
 * These headers are scoped to a single transport connection and must not
 * be propagated by a proxy. Forwarding them can enable request smuggling
 * and other protocol level attacks.
 */
export const stripHopByHopHeaders = (
    req: Request,
    _res: Response,
    next: NextFunction
): void => {
    // Read the Connection directive before the header is removed so that
    // any additional connection-specific headers it names can be dropped.
    const connection = req.headers["connection"];

    for (const header of HOP_BY_HOP_HEADERS) {
        delete req.headers[header];
    }

    if (typeof connection === "string") {
        for (const token of connection.split(",")) {
            const header = token.trim().toLowerCase();

            if (header.length > 0) {
                delete req.headers[header];
            }
        }
    }

    next();
};
