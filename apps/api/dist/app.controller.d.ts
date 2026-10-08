import { HealthService } from './health/health.service.js';
export declare class AppController {
    private readonly health;
    constructor(health: HealthService);
    getRoot(): {
        name: string;
        status: string;
    };
    live(): {
        status: string;
        uptimeSeconds: number;
    };
    ready(): Promise<{
        status: string;
        services: {
            database: {
                status: "up" | "down";
                latencyMs: number;
            };
            redis: {
                status: "up" | "down";
                latencyMs: number;
            };
        };
    }>;
    healthCheck(): Promise<{
        status: string;
        services: {
            database: {
                status: "up" | "down";
                latencyMs: number;
            };
            redis: {
                status: "up" | "down";
                latencyMs: number;
            };
        };
    }>;
}
