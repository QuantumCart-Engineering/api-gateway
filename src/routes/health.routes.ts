import { Router } from "express";

import {
    createReadinessHandler,
    getHealth
} from "../controllers/health.controller";

import type { GatewayConfig } from "../types/gateway";

export const createHealthRouter = (
    config: GatewayConfig
): Router => {
    const router = Router();

    router.get("/health", getHealth);
    router.get("/ready", createReadinessHandler(config));

    return router;
};
