import {
    checkDownstreamHealth,
    checkServiceHealth
} from "../../../services/health.service";
import { createTestConfig } from "../../helpers/config";

const jsonResponse = (status: number) => ({
    ok: status >= 200 && status < 300,
    status
});

describe("services/health", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("reports every dependency as up when all respond", async () => {
        const fetchMock = jest
            .spyOn(global, "fetch")
            .mockResolvedValue(jsonResponse(200) as Response);

        const results = await checkDownstreamHealth(
            createTestConfig()
        );

        expect(results).toHaveLength(7);
        expect(results.every((r) => r.status === "up")).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(7);
    });

    it("marks a dependency down when it returns an error status", async () => {
        jest.spyOn(global, "fetch").mockResolvedValue(
            jsonResponse(500) as Response
        );

        const [result] = await checkDownstreamHealth(
            createTestConfig()
        );

        expect(result.status).toBe("down");
        expect(result.statusCode).toBe(500);
    });

    it("marks a dependency down when the connection fails", async () => {
        jest.spyOn(global, "fetch").mockRejectedValue(
            new Error("connect ECONNREFUSED 127.0.0.1:1")
        );

        const result = await checkServiceHealth(
            createTestConfig(),
            "identity"
        );

        expect(result.status).toBe("down");
        expect(result.statusCode).toBeNull();
        expect(result.error).toMatch(/ECONNREFUSED/);
    });
});
