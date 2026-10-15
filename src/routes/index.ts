import { Router } from "express";

import { createDocsRouter } from "./docs.routes";
import { createHealthRouter } from "./health.routes";
import { createProxyRouter } from "./proxy.routes";

import type { GatewayConfig } from "../types/gateway";

/**
 * Assemble the gateway routing stack.
 *
 * Order matters:
 *   1. Health/readiness probes are handled locally.
 *   2. Docs are served locally.
 *   3. Everything else is proxied to the owning downstream service.
 */
export const createRouter = (
    config: GatewayConfig
): Router => {
    const router = Router();

    router.use(createHealthRouter(config));
    router.use(createDocsRouter(config));
    router.use(createProxyRouter(config));

    return router;
};
