export type ServiceName =
    | "identity"
    | "product"
    | "cart"
    | "order"
    | "inventory"
    | "payment"
    | "customer";

export type AuthPolicy = "public" | "required";

/**
 * Roles carried by the access token. `ADMIN` is required for
 * administrative write operations; `CUSTOMER` is the default.
 */
export type UserRole = "CUSTOMER" | "ADMIN";

export type HttpMethod =
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "OPTIONS"
    | "HEAD";

/**
 * A single public route rule used to decide authentication policy
 * and which downstream service owns a gateway path.
 */
export interface RouteRule {
    service: ServiceName;

    /**
     * Gateway path prefix this rule applies to. Matches the exact path
     * or any path nested below it (`prefix` or `prefix/...`).
     */
    pathPrefix: string;

    /**
     * HTTP methods the rule applies to. When omitted the rule applies
     * to every method.
     */
    methods?: HttpMethod[];

    auth: AuthPolicy;

    /**
     * When true and the request is authenticated, the verified user id
     * is forwarded downstream as the `x-user-id` header.
     */
    injectUserId?: boolean;

    /**
     * Roles permitted to access the route. When omitted (or empty) any
     * authenticated user is allowed. Only meaningful for protected routes.
     */
    roles?: UserRole[];

    /** Human readable description used for logging and documentation. */
    description?: string;
}

export interface ResolvedRouteRule {
    service: ServiceName;
    auth: AuthPolicy;
    injectUserId: boolean;
    roles: UserRole[];
}

export interface ServiceTarget {
    name: ServiceName;
    baseUrl: string;
    healthPath: string;
}

export interface JwtConfig {
    secret: string;
    algorithm: "HS256";
}

export interface RateLimitConfig {
    enabled: boolean;
    windowMs: number;
    max: number;
    authMax: number;
}

export interface GatewayConfig {
    nodeEnv: string;
    port: number;

    services: Record<ServiceName, ServiceTarget>;

    jwt: JwtConfig;

    proxyTimeoutMs: number;
    bodyLimit: string;

    corsOrigins: string[];

    rateLimit: RateLimitConfig;

    swaggerEnabled: boolean;
}
