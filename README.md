# QuantumCart API Gateway

Single, production-ready entry point for the QuantumCart microservices.

The gateway terminates client traffic, verifies JWTs once at the edge, injects
a trusted `x-user-id` header for downstream services, enforces rate limits,
normalises errors, and reverse-proxies requests to the owning service.

- Stateless: no database, no migrations.
- Written in TypeScript (Express 5) on Node 22.
- Listens on port **8000**.

---

## Architecture

```
                         ┌───────────────────────────┐
   Client  ── HTTPS ───► │       API Gateway         │
                         │  (auth, rate limit, proxy)│
                         └─────────────┬─────────────┘
                                       │  HTTP (x-user-id, x-request-id)
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
   identity:8001  product:8002    cart:8003      order:8004      inventory:8005
                                                                        │
                                              payment:8006  ◄───────────┘
                                              customer:8007
```

Each downstream service keeps its own detailed Swagger UI at `/api-docs`; the
gateway publishes an aggregated overview at `/api-docs` and `/openapi.json`.

### Request pipeline

1. `request-id` — assigns/preserves `x-request-id` (correlation id).
2. `helmet` — security headers.
3. `cors` — origin policy (see `ALLOWED_ORIGINS`).
4. `morgan` — request logging (silent in tests).
5. rate limiting — global limiter + stricter limiter on credential routes.
6. `header-sanitizer` — drops hop-by-hop headers.
7. body parsing (`express.json` / `urlencoded`).
8. `auth` — verifies JWT for protected routes, strips client `x-user-id`,
   injects the verified user id when required.
9. router — health/readiness, docs, then the proxy dispatcher.
10. `not-found` and `error` handlers — JSON error envelope.

---

## Authentication model

- The identity-service issues HS256 access tokens with claims
  `{ userId, email }`. The gateway verifies them **locally** using the shared
  `JWT_SECRET` (no round trip per request).
- Client-supplied `x-user-id` headers are **always stripped**. Downstream
  services can trust `x-user-id` because only the gateway sets it.
- `cart`, `order`, `payment`, `inventory` and `customer` require `x-user-id`;
  the gateway injects it for those routes. Other protected routes simply
  require a valid token.

### Route policy

| Gateway path | Service | Auth |
| --- | --- | --- |
| `POST /api/v1/auth/register` `/login` `/refresh` `/logout` | identity | public |
| `GET /api/v1/auth/me` | identity | required |
| `GET /api/v1/products*`, `GET /api/v1/categories*` | product | public |
| writes to `/api/v1/products*`, `/api/v1/categories*` | product | required |
| `/api/v1/cart*` | cart | required + `x-user-id` |
| `/api/v1/orders*` | order | required + `x-user-id` |
| `/api/v1/payments*` | payment | required + `x-user-id` |
| `/api/v1/inventory*` | inventory | required + `x-user-id` |
| `/api/v1/customers*` | customer | required + `x-user-id` |

The authoritative list lives in `src/config/routes.ts`.

---

## Error envelope

Every gateway-generated error (auth, not found, upstream failure) uses the
same JSON shape:

```json
{
  "success": false,
  "error": {
    "message": "Upstream service is unavailable",
    "requestId": "3f9c1c4e-..."
  }
}
```

Downstream 4xx/5xx responses are streamed through unmodified so services keep
full control of their own error contracts.

Upstream transport failures are translated:

| Condition | Status |
| --- | --- |
| connection refused / DNS failure | `503` |
| connection reset / socket hang up | `502` |
| timeout | `504` |

---

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | Runtime environment |
| `PORT` | no | `8000` | Listen port |
| `IDENTITY_SERVICE_URL` | yes | – | identity-service base URL |
| `PRODUCT_SERVICE_URL` | yes | – | product-service base URL |
| `CART_SERVICE_URL` | yes | – | cart-service base URL |
| `ORDER_SERVICE_URL` | yes | – | order-service base URL |
| `INVENTORY_SERVICE_URL` | yes | – | inventory-service base URL |
| `PAYMENT_SERVICE_URL` | yes | – | payment-service base URL |
| `CUSTOMER_SERVICE_URL` | yes | – | customer-service base URL |
| `JWT_SECRET` | yes | – | Must match identity-service |
| `JWT_ALGORITHM` | no | `HS256` | Only HS256 is supported |
| `PROXY_TIMEOUT_MS` | no | `30000` | Upstream request timeout |
| `BODY_LIMIT` | no | `1mb` | Max request body size |
| `ALLOWED_ORIGINS` | no | empty | Comma-separated CORS origins; empty allows all outside production |
| `RATE_LIMIT_ENABLED` | no | `true` | Toggle rate limiting |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Window (ms) |
| `RATE_LIMIT_MAX` | no | `300` | Global limit per window |
| `AUTH_RATE_LIMIT_MAX` | no | `50` | Limit for credential routes |
| `SWAGGER_ENABLED` | no | `true` | Serve `/api-docs` and `/openapi.json` |

See `.env.example` for a template.

---

## Local development

```bash
npm install
cp .env.example .env      # then set JWT_SECRET and service URLs
npm run dev               # ts-node-dev on :8000
```

Useful endpoints:

- `GET /health` — liveness (never calls downstreams)
- `GET /ready` — readiness (reports per-dependency health)
- `GET /api-docs` — Swagger UI
- `GET /openapi.json` — OpenAPI document

---

## Testing

```bash
npm run typecheck        # tsc --noEmit
npm run test:unit        # fast unit tests
npm run test:integration # real proxy against an in-process upstream
npm test                 # everything
npm run test:coverage    # coverage report
```

> The test scripts set `NODE_OPTIONS=--experimental-vm-modules` so Jest can
> `require()` the ESM-only `http-proxy-middleware` dependency.

Tests are self-contained: they inject configuration and spin up throwaway
upstream servers, so no database or other services are required.

---

## Docker

```bash
# Create the shared network once (other services use it too)
docker network create quantumcart-network

JWT_SECRET=... docker compose up --build
```

The image is multi-stage and runs as the non-root `node` user with a
`/health` based `HEALTHCHECK`.

---

## Project layout

```
src/
  config/       env loader, service registry, route registry
  constants/    HTTP constants (hop-by-hop headers, header names)
  docs/         aggregated OpenAPI definition (swagger-jsdoc)
  controllers/  health/readiness handlers
  middlewares/  request-id, auth, rate-limit, cors, sanitizer, error, 404
  routes/       health, docs, proxy, aggregate router
  services/     proxy dispatcher, health checks
  types/        shared types + Express augmentation
  utils/        app-error, jwt, logger, error envelope, upstream classification
  __tests__/    helpers, unit, integration
```
