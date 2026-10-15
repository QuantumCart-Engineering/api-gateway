import {
    createProxyMiddleware,
    fixRequestBody
} from "http-proxy-middleware";

import {
    HOP_BY_HOP_HEADERS,
    REQUEST_ID_HEADER
} from "../constants/http";
import {
    isReservedGatewayPath,
    resolveRouteRule
} from "../config/routes";
import { SERVICE_NAMES } from "../config/services";
import { sendErrorEnvelope } from "../utils/http-error";
import { logger } from "../utils/logger";
import { classifyUpstreamError } from "../utils/upstream-error";

import type { RequestHandler as ProxyRequestHandler, Options } from "http-proxy-middleware";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { GatewayConfig, ServiceName, ServiceTarget } from "../types/gateway";

/**
 * Remove hop-by-hop headers from a downstream response.
 *
 * The headers must be deleted from `proxyRes.headers` (not from the Express
 * response): http-proxy copies `proxyRes.headers` onto the response *after*
 * this listener runs, so removing them from `res` would have no effect.
 */
const stripHopByHopResponseHeaders = (
    headers: Record<string, unknown>
): void => {
    // Read the Connection directive before the header is removed so any
    // additional connection-specific headers it names can be dropped.
    const connection = headers["connection"];

    for (const header of HOP_BY_HOP_HEADERS) {
        delete headers[header];
    }

    if (typeof connection === "string") {
        for (const token of connection.split(",")) {
            const name = token.trim().toLowerCase();

            if (name.length > 0) {
                delete headers[name];
            }
        }
    }
};

const buildProxyOptions = (
    config: GatewayConfig,
    target: ServiceTarget
): Options<Request, Response> => {
    return {
        target: target.baseUrl,

        // Rewrite the Host header to the target host so downstream vhosts
        // resolve correctly.
        changeOrigin: true,

        // Add X-Forwarded-* headers (For, Host, Proto, Port) so downstream
        // services can build correct absolute URLs behind the gateway.
        xfwd: true,

        // Fail fast instead of hanging forever when a downstream is slow.
        proxyTimeout: config.proxyTimeoutMs,
        timeout: config.proxyTimeoutMs,

        // We forward the path verbatim; no rewriting is required because the
        // gateway publishes the same paths as the services implement.
        //
        // http-proxy-middleware's own logger is silenced because proxy
        // failures are handled centrally by the Express error middleware.
        logger: {
            info: () => undefined,
            warn: () => undefined,
            error: () => undefined
        },

        on: {
            proxyReq: (proxyReq, req) => {
                // Guarantee the correlation id is present downstream even if
                // the middleware ordering ever changes. This must happen
                // before the body is written (setHeader after write fails).
                if (req.id) {
                    proxyReq.setHeader(
                        REQUEST_ID_HEADER,
                        req.id
                    );
                }

                // Re-stream the body that `express.json()` already consumed.
                fixRequestBody(proxyReq, req);
            },

            proxyRes: (proxyRes) => {
                // Never propagate transport-level headers from downstream.
                stripHopByHopResponseHeaders(proxyRes.headers);
            },

            // Supplying a custom error handler prevents http-proxy-middleware
            // from writing a plain-text response. httpxy resolves (rather than
            // rejects) `proxy.web` when an error listener is present, so the
            // Express error middleware is not invoked for proxy failures;
            // the response is written here instead.
            error: (error, req, res) => {
                const info = classifyUpstreamError(error);
                const requestId = req.id;

                logger.warn("Upstream proxy failure", {
                    service: target.name,
                    requestId,
                    method: req.method,
                    path: req.url,
                    statusCode: info.statusCode,
                    error: error.message
                });

                sendErrorEnvelope(
                    res,
                    info.statusCode,
                    info.message,
                    requestId
                );
            }
        }
    };
};

/**
 * Create a single proxy middleware bound to a downstream service.
 */
export const createServiceProxy = (
    config: GatewayConfig,
    target: ServiceTarget
): ProxyRequestHandler<Request, Response> => {
    return createProxyMiddleware<Request, Response>(
        buildProxyOptions(config, target)
    );
};

/**
 * Create one proxy per downstream service and dispatch each incoming
 * request to the service that owns its path.
 *
 * Dispatching explicitly (rather than mounting a proxy per prefix with
 * `app.use(prefix, ...)`) preserves the full request path when forwarding.
 */
export const createProxyDispatcher = (
    config: GatewayConfig
): RequestHandler => {
    const proxies = {} as Record<ServiceName, ProxyRequestHandler<Request, Response>>;

    for (const name of SERVICE_NAMES) {
        proxies[name] = createServiceProxy(
            config,
            config.services[name]
        );
    }

    return (
        req: Request,
        res: Response,
        next: NextFunction
    ): void => {
        if (isReservedGatewayPath(req.path)) {
            next();
            return;
        }

        const route = resolveRouteRule(req.method, req.path);

        if (!route) {
            // No matching downstream: let the not-found handler respond.
            next();
            return;
        }

        proxies[route.service](req, res, next);
    };
};

export { buildProxyOptions };
