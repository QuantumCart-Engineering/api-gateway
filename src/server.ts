import { createApp } from "./app";
import { getGatewayConfig } from "./config/env";
import { logger } from "./utils/logger";

const config = getGatewayConfig();

const app = createApp(config);

const server = app.listen(config.port, () => {
    logger.info("API Gateway listening", {
        port: config.port,
        env: config.nodeEnv,
        docs: config.swaggerEnabled ? "/api-docs" : "disabled"
    });
});

const SHUTDOWN_TIMEOUT_MS = 10000;

const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully`);

    const forceExit = setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    forceExit.unref();

    server.close((error) => {
        clearTimeout(forceExit);

        if (error) {
            logger.error("Error during shutdown", {
                error: error.message
            });
            process.exit(1);
        }

        logger.info("API Gateway stopped");
        process.exit(0);
    });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", {
        reason: reason instanceof Error ? reason.message : String(reason)
    });
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", { error: error.message });
    process.exit(1);
});
