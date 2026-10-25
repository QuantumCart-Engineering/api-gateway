import {
    getProxyPrefixesByService,
    isReservedGatewayPath,
    resolveRouteRule
} from "../../../config/routes";

describe("config/routes", () => {
    describe("resolveRouteRule", () => {
        it("exposes auth registration and login as public", () => {
            expect(
                resolveRouteRule("POST", "/api/v1/auth/register")
            ).toMatchObject({ service: "identity", auth: "public" });
            expect(
                resolveRouteRule("POST", "/api/v1/auth/login")
            ).toMatchObject({ service: "identity", auth: "public" });
        });

        it("protects the current user endpoint", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/auth/me")
            ).toMatchObject({ service: "identity", auth: "required" });
        });

        it("allows public product reads but protects writes", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/products")
            ).toMatchObject({ service: "product", auth: "public" });
            expect(
                resolveRouteRule("GET", "/api/v1/products/42")
            ).toMatchObject({ service: "product", auth: "public" });
            expect(
                resolveRouteRule("POST", "/api/v1/products")
            ).toMatchObject({ service: "product", auth: "required" });
            expect(
                resolveRouteRule("DELETE", "/api/v1/products/42")
            ).toMatchObject({ service: "product", auth: "required" });
        });

        it("restricts product and category writes to admins", () => {
            expect(
                resolveRouteRule("POST", "/api/v1/products")?.roles
            ).toEqual(["ADMIN"]);
            expect(
                resolveRouteRule("PUT", "/api/v1/products/42")?.roles
            ).toEqual(["ADMIN"]);
            expect(
                resolveRouteRule("DELETE", "/api/v1/products/42")?.roles
            ).toEqual(["ADMIN"]);
            expect(
                resolveRouteRule("POST", "/api/v1/categories")?.roles
            ).toEqual(["ADMIN"]);
            expect(
                resolveRouteRule("PUT", "/api/v1/categories/42")?.roles
            ).toEqual(["ADMIN"]);
        });

        it("leaves public reads and customer routes without a role restriction", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/products")?.roles
            ).toEqual([]);
            expect(
                resolveRouteRule("GET", "/api/v1/cart")?.roles
            ).toEqual([]);
        });

        it("protects user owned resources and injects the user id", () => {
            for (const path of [
                "/api/v1/cart",
                "/api/v1/cart/items",
                "/api/v1/orders",
                "/api/v1/orders/1",
                "/api/v1/payments",
                "/api/v1/inventory",
                "/api/v1/customers",
                "/api/v1/customers/1/addresses"
            ]) {
                expect(resolveRouteRule("GET", path)).toMatchObject({
                    auth: "required",
                    injectUserId: true
                });
            }
        });

        it("maps each top level resource to the owning service", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/cart")?.service
            ).toBe("cart");
            expect(
                resolveRouteRule("GET", "/api/v1/orders")?.service
            ).toBe("order");
            expect(
                resolveRouteRule("GET", "/api/v1/payments")?.service
            ).toBe("payment");
            expect(
                resolveRouteRule("GET", "/api/v1/inventory")?.service
            ).toBe("inventory");
            expect(
                resolveRouteRule("GET", "/api/v1/customers")?.service
            ).toBe("customer");
        });

        it("returns null for unknown paths", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/unknown")
            ).toBeNull();
            expect(resolveRouteRule("GET", "/nope")).toBeNull();
        });

        it("restricts every reporting endpoint to admins", () => {
            const reportPaths = [
                "/api/v1/orders/reports/summary",
                "/api/v1/orders/reports/timeseries",
                "/api/v1/orders/reports/top-products",
                "/api/v1/payments/reports/summary",
                "/api/v1/payments/reports/timeseries",
                "/api/v1/customers/reports/summary",
                "/api/v1/products/reports/summary"
            ];

            for (const path of reportPaths) {
                expect(resolveRouteRule("GET", path)).toMatchObject({
                    auth: "required",
                    roles: ["ADMIN"]
                });
            }
        });

        it("keeps product reports admin-only despite public product reads", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/products")?.auth
            ).toBe("public");
            expect(
                resolveRouteRule(
                    "GET",
                    "/api/v1/products/reports/summary"
                )?.roles
            ).toEqual(["ADMIN"]);
        });

        it("routes reports to the owning service", () => {
            expect(
                resolveRouteRule(
                    "GET",
                    "/api/v1/orders/reports/summary"
                )?.service
            ).toBe("order");
            expect(
                resolveRouteRule(
                    "GET",
                    "/api/v1/payments/reports/summary"
                )?.service
            ).toBe("payment");
            expect(
                resolveRouteRule(
                    "GET",
                    "/api/v1/customers/reports/summary"
                )?.service
            ).toBe("customer");
            expect(
                resolveRouteRule(
                    "GET",
                    "/api/v1/products/reports/summary"
                )?.service
            ).toBe("product");
        });

        it("does not treat a prefix as matching an unrelated longer segment", () => {
            expect(
                resolveRouteRule("GET", "/api/v1/cartoon")
            ).toBeNull();
        });
    });

    describe("isReservedGatewayPath", () => {
        it("recognises local gateway paths", () => {
            expect(isReservedGatewayPath("/health")).toBe(true);
            expect(isReservedGatewayPath("/ready")).toBe(true);
            expect(isReservedGatewayPath("/api-docs")).toBe(true);
            expect(isReservedGatewayPath("/openapi.json")).toBe(true);
            expect(isReservedGatewayPath("/api-docs/")).toBe(true);
        });

        it("does not reserve API paths", () => {
            expect(isReservedGatewayPath("/api/v1/products")).toBe(
                false
            );
        });
    });

    describe("getProxyPrefixesByService", () => {
        it("derives unique prefixes for every service", () => {
            const prefixes = getProxyPrefixesByService();

            expect(prefixes.identity).toContain(
                "/api/v1/auth/login"
            );
            expect(prefixes.product).toEqual(
                expect.arrayContaining([
                    "/api/v1/products",
                    "/api/v1/categories"
                ])
            );
            expect(prefixes.cart).toEqual(["/api/v1/cart"]);
            expect(prefixes.order).toEqual(
                expect.arrayContaining([
                    "/api/v1/orders",
                    "/api/v1/orders/reports"
                ])
            );
            expect(prefixes.payment).toEqual(
                expect.arrayContaining([
                    "/api/v1/payments",
                    "/api/v1/payments/reports"
                ])
            );
            expect(prefixes.inventory).toEqual([
                "/api/v1/inventory"
            ]);
            expect(prefixes.customer).toEqual(
                expect.arrayContaining([
                    "/api/v1/customers",
                    "/api/v1/customers/reports"
                ])
            );
        });
    });
});
