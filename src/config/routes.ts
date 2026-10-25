import type {
    HttpMethod,
    ResolvedRouteRule,
    RouteRule,
    ServiceName
} from "../types/gateway";

/**
 * Centralised route registry.
 *
 * Every public gateway path is declared here together with the downstream
 * service that owns it and its authentication policy. This is the single
 * source of truth used by:
 *   - the proxy layer (to decide the target service), and
 *   - the authentication middleware (to decide whether a JWT is required).
 *
 * Downstream paths are intentionally identical to the public paths, so no
 * path rewriting is required. Internal event flows (RabbitMQ / east-west
 * service calls) are not routed through the gateway.
 */
export const ROUTE_RULES: readonly RouteRule[] = [
    // ------------------------------------------------------------------
    // Admin analytics / reporting
    //
    // Declared first so they win over the broader resource rules below
    // (first match wins). Reporting reads cross-user aggregates, so they
    // are restricted to administrators at the gateway boundary.
    // ------------------------------------------------------------------
    {
        service: "order",
        pathPrefix: "/api/v1/orders/reports",
        auth: "required",
        roles: ["ADMIN"],
        injectUserId: true,
        description: "Order analytics reports (admin only)"
    },
    {
        service: "payment",
        pathPrefix: "/api/v1/payments/reports",
        auth: "required",
        roles: ["ADMIN"],
        injectUserId: true,
        description: "Payment analytics reports (admin only)"
    },
    {
        service: "customer",
        pathPrefix: "/api/v1/customers/reports",
        auth: "required",
        roles: ["ADMIN"],
        injectUserId: true,
        description: "Customer analytics reports (admin only)"
    },
    {
        service: "product",
        pathPrefix: "/api/v1/products/reports",
        auth: "required",
        roles: ["ADMIN"],
        description: "Product catalogue reports (admin only)"
    },

    // ------------------------------------------------------------------
    // Identity / authentication
    // ------------------------------------------------------------------
    {
        service: "identity",
        pathPrefix: "/api/v1/auth/register",
        auth: "public",
        description: "Register a new user"
    },
    {
        service: "identity",
        pathPrefix: "/api/v1/auth/login",
        auth: "public",
        description: "Authenticate a user and issue tokens"
    },
    {
        service: "identity",
        pathPrefix: "/api/v1/auth/refresh",
        auth: "public",
        description: "Rotate a refresh token and issue new tokens"
    },
    {
        service: "identity",
        pathPrefix: "/api/v1/auth/logout",
        auth: "public",
        description: "Revoke a refresh token"
    },
    {
        service: "identity",
        pathPrefix: "/api/v1/auth/me",
        auth: "required",
        description: "Return the authenticated user profile"
    },

    // ------------------------------------------------------------------
    // Product catalogue (reads are public, writes require authentication)
    // ------------------------------------------------------------------
    {
        service: "product",
        pathPrefix: "/api/v1/products",
        methods: ["GET"],
        auth: "public",
        description: "Browse and read products"
    },
    {
        service: "product",
        pathPrefix: "/api/v1/products",
        auth: "required",
        roles: ["ADMIN"],
        description: "Create, update and delete products"
    },
    {
        service: "product",
        pathPrefix: "/api/v1/categories",
        methods: ["GET"],
        auth: "public",
        description: "Browse and read categories"
    },
    {
        service: "product",
        pathPrefix: "/api/v1/categories",
        auth: "required",
        roles: ["ADMIN"],
        description: "Create, update and delete categories"
    },

    // ------------------------------------------------------------------
    // User owned / protected resources
    // ------------------------------------------------------------------
    {
        service: "cart",
        pathPrefix: "/api/v1/cart",
        auth: "required",
        injectUserId: true,
        description: "Shopping cart"
    },
    {
        service: "order",
        pathPrefix: "/api/v1/orders",
        auth: "required",
        injectUserId: true,
        description: "Orders"
    },
    {
        service: "payment",
        pathPrefix: "/api/v1/payments",
        auth: "required",
        injectUserId: true,
        description: "Payments"
    },
    {
        service: "inventory",
        pathPrefix: "/api/v1/inventory",
        auth: "required",
        injectUserId: true,
        description: "Inventory management"
    },
    {
        service: "customer",
        pathPrefix: "/api/v1/customers",
        auth: "required",
        injectUserId: true,
        description: "Customer profiles and addresses"
    }
];

/**
 * Proxy prefixes per service. Derived from {@link ROUTE_RULES} so the
 * proxy layer and the auth layer can never drift apart.
 */
export const getProxyPrefixesByService = (): Record<
    ServiceName,
    string[]
> => {
    const prefixes = {} as Record<ServiceName, string[]>;

    for (const rule of ROUTE_RULES) {
        const existing = prefixes[rule.service] ?? [];

        if (!existing.includes(rule.pathPrefix)) {
            existing.push(rule.pathPrefix);
        }

        prefixes[rule.service] = existing;
    }

    return prefixes;
};

const normalizePath = (path: string): string => {
    if (path.length > 1 && path.endsWith("/")) {
        return path.slice(0, -1);
    }

    return path;
};

const matchesPrefix = (
    path: string,
    prefix: string
): boolean => {
    const normalized = normalizePath(path);

    return (
        normalized === prefix ||
        normalized.startsWith(`${prefix}/`)
    );
};

/**
 * Resolve the route rule for a method/path combination.
 *
 * Rules are evaluated in declaration order and the first matching rule
 * wins, which lets a method specific rule override a broader one.
 */
export const resolveRouteRule = (
    method: string,
    path: string
): ResolvedRouteRule | null => {
    const upperMethod = method.toUpperCase();

    for (const rule of ROUTE_RULES) {
        if (!matchesPrefix(path, rule.pathPrefix)) {
            continue;
        }

        if (
            rule.methods &&
            !rule.methods.includes(upperMethod as HttpMethod)
        ) {
            continue;
        }

        return {
            service: rule.service,
            auth: rule.auth,
            injectUserId: rule.injectUserId ?? false,
            roles: rule.roles ?? []
        };
    }

    return null;
};

/**
 * Whether the gateway itself is responsible for a path (health checks,
 * readiness, docs) rather than forwarding it to a downstream service.
 */
export const RESERVED_GATEWAY_PREFIXES: readonly string[] = [
    "/health",
    "/ready",
    "/api-docs",
    "/openapi.json"
];

export const isReservedGatewayPath = (path: string): boolean => {
    const normalized = normalizePath(path);

    return RESERVED_GATEWAY_PREFIXES.some(
        (prefix) =>
            normalized === prefix ||
            normalized.startsWith(`${prefix}/`)
    );
};
