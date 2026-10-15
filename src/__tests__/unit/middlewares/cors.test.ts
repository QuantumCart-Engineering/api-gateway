import { isOriginAllowed } from "../../../middlewares/cors.middleware";

describe("middlewares/cors", () => {
    it("allows non-browser requests without an origin", () => {
        expect(
            isOriginAllowed(undefined, [], "production")
        ).toBe(true);
    });

    it("allows explicitly listed origins", () => {
        expect(
            isOriginAllowed(
                "https://shop.example",
                ["https://shop.example"],
                "production"
            )
        ).toBe(true);
    });

    it("denies unlisted origins in production", () => {
        expect(
            isOriginAllowed(
                "https://evil.example",
                ["https://shop.example"],
                "production"
            )
        ).toBe(false);
    });

    it("allows any origin outside production", () => {
        expect(
            isOriginAllowed(
                "https://anything.example",
                [],
                "development"
            )
        ).toBe(true);
    });
});
