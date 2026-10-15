import { Router } from "express";

import { createProxyDispatcher } from "../services/proxy.service";

import type { GatewayConfig } from "../types/gateway";

/**
 * Router that forwards every non-reserved request to the downstream
 * service that owns its path (see `config/routes.ts`).
 */
export const createProxyRouter = (
    config: GatewayConfig
): Router => {
    const router = Router();

    router.use(createProxyDispatcher(config));

    return router;
};
