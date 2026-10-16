import swaggerJSDoc from "swagger-jsdoc";

import {
    SERVICE_NAMES,
    SERVICE_URL_ENV
} from "../config/services";

/**
 * Aggregated OpenAPI document for the public gateway surface.
 *
 * The gateway is a thin proxy, so this document describes the public API
 * and the authentication model rather than re-declaring every downstream
 * schema. Each service still exposes its own detailed Swagger UI at
 * `/api-docs`, but the `paths` below are declared here because the gateway
 * forwards requests generically instead of handling each route explicitly.
 */
const errorSchema = {
    type: "object",
    properties: {
        success: { type: "boolean", example: false },
        error: {
            type: "object",
            properties: {
                message: { type: "string" },
                requestId: {
                    type: "string",
                    format: "uuid",
                    nullable: true
                }
            },
            required: ["message"]
        }
    },
    required: ["success", "error"]
};

const securityScheme = {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
        "Access token issued by the identity-service. Send as `Authorization: Bearer <token>`."
};

const standardErrorResponses = {
    400: {
        description: "Bad request",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    401: {
        description: "Authentication required or token invalid",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    403: {
        description: "Forbidden",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    429: {
        description: "Too many requests",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    502: {
        description: "Upstream service request failed",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    503: {
        description: "Upstream service unavailable",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    },
    504: {
        description: "Upstream service timed out",
        content: {
            "application/json": { schema: { $ref: "#/components/schemas/Error" } }
        }
    }
};

const jsonBody = (schema: unknown) => ({
    content: {
        "application/json": { schema }
    }
});

const protectedOperation = (
    summary: string,
    tag: string,
    description?: string
) => ({
    tags: [tag],
    summary,
    ...(description ? { description } : {}),
    security: [{ bearerAuth: [] }],
    parameters: [
        {
            name: "x-request-id",
            in: "header",
            required: false,
            schema: { type: "string" },
            description:
                "Optional correlation id; generated when absent."
        }
    ],
    responses: {
        200: { description: "Successful response" },
        ...standardErrorResponses
    }
});

const pathParameter = (
    name: string,
    description = "Resource identifier"
) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
    description
});

const dependencies = SERVICE_NAMES.map(
    (name) => `${name} (${SERVICE_URL_ENV[name]})`
).join(", ");

const swaggerDefinition = {
    openapi: "3.0.3",
    info: {
        title: "QuantumCart API Gateway",
        version: "1.0.0",
        description: [
            "Single entry point for the QuantumCart microservices.",
            "",
            "The gateway terminates client TLS, enforces rate limits,",
            "verifies JWTs once, and forwards requests (with a trusted",
            "`x-user-id` header) to the owning service.",
            "",
            "Role-based access: product and category write operations",
            "(`POST`/`PUT`/`DELETE`) require a token carrying the",
            "`ADMIN` role; other protected routes only require a valid",
            "token.",
            "",
            `Downstream services: ${dependencies}.`
        ].join("\n")
    },
    servers: [
        {
            url: `http://localhost:${process.env.PORT || 8000}`,
            description: "Local gateway"
        }
    ],
    tags: [
        { name: "Health" },
        { name: "Auth" },
        { name: "Products" },
        { name: "Categories" },
        { name: "Cart" },
        { name: "Orders" },
        { name: "Payments" },
        { name: "Inventory" },
        { name: "Customers" }
    ],
    components: {
        securitySchemes: {
            bearerAuth: securityScheme
        },
        schemas: {
            Error: errorSchema
        }
    },
    paths: {
        "/health": {
            get: {
                tags: ["Health"],
                summary: "Gateway liveness probe",
                responses: {
                    200: { description: "Gateway is alive" }
                }
            }
        },
        "/ready": {
            get: {
                tags: ["Health"],
                summary: "Gateway readiness probe",
                description:
                    "Reports connectivity to each downstream service.",
                responses: {
                    200: { description: "All dependencies are up" },
                    503: {
                        description: "One or more dependencies are down"
                    }
                }
            }
        },

        "/api/v1/auth/register": {
            post: {
                tags: ["Auth"],
                summary: "Register a new user",
                requestBody: jsonBody({
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email"
                        },
                        password: {
                            type: "string",
                            format: "password"
                        },
                        name: { type: "string" }
                    }
                }),
                responses: {
                    201: { description: "User registered" },
                    ...standardErrorResponses
                }
            }
        },
        "/api/v1/auth/login": {
            post: {
                tags: ["Auth"],
                summary: "Log in and obtain tokens",
                requestBody: jsonBody({
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: {
                            type: "string",
                            format: "email"
                        },
                        password: {
                            type: "string",
                            format: "password"
                        }
                    }
                }),
                responses: {
                    200: { description: "Authenticated" },
                    ...standardErrorResponses
                }
            }
        },
        "/api/v1/auth/refresh": {
            post: {
                tags: ["Auth"],
                summary: "Rotate a refresh token",
                responses: {
                    200: { description: "Tokens refreshed" },
                    ...standardErrorResponses
                }
            }
        },
        "/api/v1/auth/logout": {
            post: {
                tags: ["Auth"],
                summary: "Revoke a refresh token",
                responses: {
                    200: { description: "Logged out" },
                    ...standardErrorResponses
                }
            }
        },
        "/api/v1/auth/me": {
            get: protectedOperation(
                "Get the authenticated user profile",
                "Auth"
            )
        },

        "/api/v1/products": {
            get: {
                tags: ["Products"],
                summary: "List products (public)",
                responses: {
                    200: { description: "Product list" },
                    ...standardErrorResponses
                }
            },
            post: protectedOperation(
                "Create a product",
                "Products"
            )
        },
        "/api/v1/products/{id}": {
            get: {
                tags: ["Products"],
                summary: "Get a product (public)",
                parameters: [pathParameter("id")],
                responses: {
                    200: { description: "Product" },
                    ...standardErrorResponses
                }
            },
            put: {
                ...protectedOperation("Update a product", "Products"),
                parameters: [pathParameter("id")]
            },
            delete: {
                ...protectedOperation("Delete a product", "Products"),
                parameters: [pathParameter("id")]
            }
        },
        "/api/v1/categories": {
            get: {
                tags: ["Categories"],
                summary: "List categories (public)",
                responses: {
                    200: { description: "Category list" },
                    ...standardErrorResponses
                }
            },
            post: protectedOperation(
                "Create a category",
                "Categories"
            )
        },

        "/api/v1/cart": {
            get: protectedOperation("Get the current cart", "Cart")
        },
        "/api/v1/cart/items": {
            post: protectedOperation("Add an item to the cart", "Cart")
        },
        "/api/v1/cart/items/{id}": {
            put: {
                ...protectedOperation(
                    "Update a cart item",
                    "Cart"
                ),
                parameters: [pathParameter("id")]
            },
            delete: {
                ...protectedOperation(
                    "Remove a cart item",
                    "Cart"
                ),
                parameters: [pathParameter("id")]
            }
        },

        "/api/v1/orders": {
            get: protectedOperation("List orders", "Orders"),
            post: protectedOperation("Create an order", "Orders")
        },
        "/api/v1/orders/{id}": {
            get: {
                ...protectedOperation("Get an order", "Orders"),
                parameters: [pathParameter("id")]
            }
        },

        "/api/v1/payments": {
            get: protectedOperation("List payments", "Payments"),
            post: protectedOperation("Create a payment", "Payments")
        },

        "/api/v1/inventory": {
            get: protectedOperation(
                "List inventory",
                "Inventory"
            )
        },
        "/api/v1/inventory/{productId}": {
            get: {
                ...protectedOperation(
                    "Get inventory for a product",
                    "Inventory"
                ),
                parameters: [pathParameter("productId")]
            },
            put: {
                ...protectedOperation(
                    "Update inventory for a product",
                    "Inventory"
                ),
                parameters: [pathParameter("productId")]
            }
        },

        "/api/v1/customers": {
            get: protectedOperation(
                "List customers",
                "Customers"
            ),
            post: protectedOperation(
                "Create a customer profile",
                "Customers"
            )
        },
        "/api/v1/customers/{id}": {
            get: {
                ...protectedOperation(
                    "Get a customer",
                    "Customers"
                ),
                parameters: [pathParameter("id")]
            }
        },
        "/api/v1/customers/{id}/addresses": {
            get: {
                ...protectedOperation(
                    "List a customer's addresses",
                    "Customers"
                ),
                parameters: [pathParameter("id")]
            },
            post: {
                ...protectedOperation(
                    "Add an address for a customer",
                    "Customers"
                ),
                parameters: [pathParameter("id")]
            }
        }
    }
};

const options: swaggerJSDoc.Options = {
    definition: swaggerDefinition,

    // The gateway forwards requests generically, so the paths are declared
    // above. Scanning the route files keeps this consistent with the other
    // services and picks up any future `@openapi` annotations.
    apis: ["./src/routes/*.ts", "./src/app.ts"],

    failOnErrors: true
};

export const swaggerSpec = swaggerJSDoc(options);
