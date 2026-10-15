import type {
    GatewayConfig,
    ServiceTarget,
    ServiceName
} from "../types/gateway";

export interface DownstreamHealth {
    service: ServiceName;
    status: "up" | "down";
    statusCode: number | null;
    latencyMs: number;
    error?: string;
}

const DEFAULT_TIMEOUT_MS = 2000;

const checkService = async (
    target: ServiceTarget,
    timeoutMs: number
): Promise<DownstreamHealth> => {
    const url = new URL(
        target.healthPath,
        ensureTrailingSlash(target.baseUrl)
    ).toString();

    const controller = new AbortController();

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const startedAt = Date.now();

    try {
        const response = await fetch(url, {
            method: "GET",
            signal: controller.signal,
            headers: {
                accept: "application/json"
            }
        });

        return {
            service: target.name,
            status: response.ok ? "up" : "down",
            statusCode: response.status,
            latencyMs: Date.now() - startedAt,
            ...(response.ok
                ? {}
                : { error: `Downstream returned ${response.status}` })
        };
    } catch (error) {
        return {
            service: target.name,
            status: "down",
            statusCode: null,
            latencyMs: Date.now() - startedAt,
            error:
                error instanceof Error
                    ? error.message
                    : "Unknown downstream error"
        };
    } finally {
        clearTimeout(timer);
    }
};

const ensureTrailingSlash = (baseUrl: string): string =>
    baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

export const checkDownstreamHealth = async (
    config: GatewayConfig,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DownstreamHealth[]> => {
    const targets = Object.values(config.services);

    return Promise.all(
        targets.map((target) => checkService(target, timeoutMs))
    );
};

export const checkServiceHealth = async (
    config: GatewayConfig,
    name: ServiceName,
    timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<DownstreamHealth> => {
    return checkService(config.services[name], timeoutMs);
};
