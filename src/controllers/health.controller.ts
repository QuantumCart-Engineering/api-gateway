import type { Request, Response } from "express";

import { getGatewayConfig } from "../config/env";
import { checkDownstreamHealth } from "../services/health.service";
import { asyncHandler } from "../utils/async-handler";

import type { GatewayConfig } from "../types/gateway";

/**
 * Liveness probe. Confirms the gateway process is running. It performs no
 * downstream calls so a dependency outage cannot restart the gateway.
 */
export const getHealth = (
    _req: Request,
    res: Response
): void => {
    res.status(200).json({
        status: "ok",
        service: "api-gateway",
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
};

export const createReadinessHandler = (
    config: GatewayConfig = getGatewayConfig()
) =>
    asyncHandler(async (_req, res) => {
        const dependencies = await checkDownstreamHealth(config);

        const ready = dependencies.every(
            (dependency) => dependency.status === "up"
        );

        res.status(ready ? 200 : 503).json({
            status: ready ? "ready" : "not_ready",
            service: "api-gateway",
            timestamp: new Date().toISOString(),
            dependencies
        });
    });
