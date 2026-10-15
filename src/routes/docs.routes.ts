import { Router } from "express";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec } from "../docs/swagger";
import { logger } from "../utils/logger";

import type { GatewayConfig } from "../types/gateway";

/**
 * Serves the aggregated OpenAPI document and Swagger UI.
 *
 * Disabled when `SWAGGER_ENABLED=false` so production deployments can
 * avoid exposing the interactive docs surface.
 */
export const createDocsRouter = (
    config: GatewayConfig
): Router => {
    const router = Router();

    if (!config.swaggerEnabled) {
        return router;
    }

    router.get("/openapi.json", (_req, res) => {
        res.status(200).json(swaggerSpec);
    });

    router.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(swaggerSpec, {
            customSiteTitle: "QuantumCart API Gateway"
        })
    );

    logger.info("Swagger UI enabled", {
        ui: "/api-docs",
        spec: "/openapi.json"
    });

    return router;
};
