import { PerformanceMonitor } from "../utils/performance";

export class HealthCheckService {
  private server: any;
  private isRunning = false;

  async start(port: number = 3000) {
    if (this.isRunning) return;

    this.server = Bun.serve({
      port,
      fetch: async (req) => {
        const url = new URL(req.url);
        
        if (url.pathname === "/health") {
          return this.handleHealthCheck(req);
        }
        
        if (url.pathname === "/metrics") {
          return this.handleMetrics(req);
        }
        
        return new Response("Not Found", { status: 404 });
      },
    });

    this.isRunning = true;
    console.log(`Health check server running on port ${port}`);
  }

  private async handleHealthCheck(req: Request): Promise<Response> {
    const startTime = Bun.nanoseconds();
    
    try {
      // Check database connectivity
      const dbCheck = await PerformanceMonitor.measure("db_health", async () => {
        // Add your database health check here
        return { status: "healthy" };
      });

      // Check Discord API connectivity
      const discordCheck = await PerformanceMonitor.measure("discord_health", async () => {
        // Add your Discord API health check here
        return { status: "healthy" };
      });

      const responseTime = (Bun.nanoseconds() - startTime) / 1e6;

      return new Response(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime.toFixed(2)}ms`,
        checks: {
          database: dbCheck,
          discord: discordCheck
        }
      }), {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({
        status: "unhealthy",
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }

  private async handleMetrics(req: Request): Promise<Response> {
    // Return performance metrics
    const metrics = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(metrics), {
      headers: { "Content-Type": "application/json" }
    });
  }

  stop() {
    if (this.server) {
      this.server.stop();
      this.isRunning = false;
    }
  }
} 