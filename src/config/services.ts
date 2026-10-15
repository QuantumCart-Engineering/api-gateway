import {
    DEFAULT_SERVICE_HEALTH_PATH
} from "../constants/http";

import type {
    ServiceName,
    ServiceTarget
} from "../types/gateway";

/**
 * Canonical service names. The gateway treats these as the only valid
 * downstream targets. Adding a new microservice requires registering the
 * name here, providing its URL env var and adding a route rule.
 */
export const SERVICE_NAMES: readonly ServiceName[] = [
    "identity",
    "product",
    "cart",
    "order",
    "inventory",
    "payment",
    "customer"
];

/**
 * Environment variable that holds each service base URL.
 */
export const SERVICE_URL_ENV: Record<ServiceName, string> = {
    identity: "IDENTITY_SERVICE_URL",
    product: "PRODUCT_SERVICE_URL",
    cart: "CART_SERVICE_URL",
    order: "ORDER_SERVICE_URL",
    inventory: "INVENTORY_SERVICE_URL",
    payment: "PAYMENT_SERVICE_URL",
    customer: "CUSTOMER_SERVICE_URL"
};

/**
 * Health check path for each service. All currently implemented services
 * expose `GET /health`.
 */
export const SERVICE_HEALTH_PATH: Record<ServiceName, string> = {
    identity: DEFAULT_SERVICE_HEALTH_PATH,
    product: DEFAULT_SERVICE_HEALTH_PATH,
    cart: DEFAULT_SERVICE_HEALTH_PATH,
    order: DEFAULT_SERVICE_HEALTH_PATH,
    inventory: DEFAULT_SERVICE_HEALTH_PATH,
    payment: DEFAULT_SERVICE_HEALTH_PATH,
    customer: DEFAULT_SERVICE_HEALTH_PATH
};

export const buildServiceTargets = (
    urls: Record<ServiceName, string>
): Record<ServiceName, ServiceTarget> => {
    const targets = {} as Record<ServiceName, ServiceTarget>;

    for (const name of SERVICE_NAMES) {
        targets[name] = {
            name,
            baseUrl: urls[name],
            healthPath: SERVICE_HEALTH_PATH[name]
        };
    }

    return targets;
};

export const isServiceName = (
    value: string
): value is ServiceName => {
    return (SERVICE_NAMES as readonly string[]).includes(value);
};
