import "express";

import type { AccessTokenPayload } from "../utils/jwt";

declare global {
    namespace Express {
        interface Request {
            /**
             * Correlation id assigned by the request-id middleware. Present
             * on every request that reaches user code.
             */
            id?: string;

            /**
             * Decoded access token payload for authenticated requests.
             * Populated by the auth middleware.
             */
            user?: AccessTokenPayload;
        }
    }
}

export {};
