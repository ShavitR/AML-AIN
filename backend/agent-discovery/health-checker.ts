import { AgentRegistration, AgentHealth } from './types';
import { AgentDiscoveryService } from './discovery-service';

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  successThreshold: number;
  failureThreshold: number;
  customHeaders?: Record<string, string>;
  customBody?: any;
}

export interface HealthCheckResult {
  agentId: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  responseTime: number;
  error?: string;
  timestamp: Date;
  details: {
    httpStatus?: number;
    responseSize?: number | undefined;
    latency?: number;
    resourceUsage?: {
      cpu: number;
      memory: number;
      disk: number;
      network: number;
    };
  };
}

export interface HealthCheckEvent {
  type: 'health_check_started' | 'health_check_completed' | 'health_status_changed' | 'agent_unhealthy' | 'agent_recovered';
  agentId: string;
  timestamp: Date;
  data: any;
}

export class AgentHealthChecker {
  private discoveryService: AgentDiscoveryService;
  private config: HealthCheckConfig;
  private healthChecks: Map<string, NodeJS.Timeout> = new Map();
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private eventListeners: ((event: HealthCheckEvent) => void)[] = [];
  private isRunning: boolean = false;

  constructor(discoveryService: AgentDiscoveryService, config: Partial<HealthCheckConfig> = {}) {
    this.discoveryService = discoveryService;
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 10000, // 10 seconds
      retries: 3,
      successThreshold: 2,
      failureThreshold: 3,
      ...config
    };
  }

  /**
   * Start health checking for all agents
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    const agents = await this.discoveryService.getAllAgents();
    
    for (const agent of agents) {
      await this.startHealthCheck(agent.id);
    }

    console.log(`Started health checking for ${agents.length} agents`);
  }

  /**
   * Stop health checking
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    // Clear all health check intervals
    for (const [agentId, interval] of this.healthChecks) {
      clearInterval(interval);
      this.healthChecks.delete(agentId);
    }

    console.log('Stopped health checking');
  }

  /**
   * Start health checking for a specific agent
   */
  async startHealthCheck(agentId: string): Promise<void> {
    // Stop existing health check if running
    await this.stopHealthCheck(agentId);

    const interval = setInterval(async () => {
      await this.performHealthCheck(agentId);
    }, this.config.interval);

    this.healthChecks.set(agentId, interval);
    
    // Perform initial health check
    await this.performHealthCheck(agentId);
  }

  /**
   * Stop health checking for a specific agent
   */
  async stopHealthCheck(agentId: string): Promise<void> {
    const interval = this.healthChecks.get(agentId);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(agentId);
    }
  }

  /**
   * Perform a health check for a specific agent
   */
  async performHealthCheck(agentId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const agent = await this.discoveryService.getAgentById(agentId);
    
    if (!agent) {
      const result: HealthCheckResult = {
        agentId,
        status: 'unknown',
        responseTime: 0,
        error: 'Agent not found',
        timestamp: new Date(),
        details: {}
      };
      
      this.emitEvent({
        type: 'health_check_completed',
        agentId,
        timestamp: new Date(),
        data: result
      });
      
      return result;
    }

    let result: HealthCheckResult | undefined;
    let retries = 0;

    while (retries < this.config.retries) {
      try {
        result = await this.checkAgentHealth(agent);
        break;
      } catch (error) {
        retries++;
        if (retries >= this.config.retries) {
          result = {
            agentId,
            status: 'unhealthy',
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            details: {}
          };
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!result) {
      throw new Error('Health check failed to produce a result');
    }

    // Store health check result
    this.storeHealthResult(agentId, result);
    
    // Update agent health in discovery service
    await this.updateAgentHealth(agentId, result);
    
    // Emit event
    this.emitEvent({
      type: 'health_check_completed',
      agentId,
      timestamp: new Date(),
      data: result
    });

    return result;
  }

  /**
   * Check agent health by making a request to its health endpoint
   */
  private async checkAgentHealth(agent: AgentRegistration): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const healthEndpoint = this.getHealthEndpoint(agent);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const requestInit: RequestInit = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AML-AIN-HealthChecker/1.0',
          ...this.config.customHeaders
        },
        signal: controller.signal
      };

      if (this.config.customBody) {
        requestInit.body = JSON.stringify(this.config.customBody);
      }

      const response = await fetch(healthEndpoint, requestInit);

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const healthData = await response.json();
      
      const contentLength = response.headers.get('content-length');
      const responseSize = contentLength ? parseInt(contentLength) : undefined;

      return {
        agentId: agent.id,
        status: this.determineHealthStatus(healthData, responseTime),
        responseTime,
        timestamp: new Date(),
        details: {
          httpStatus: response.status,
          responseSize,
          latency: responseTime,
          resourceUsage: healthData.resourceUsage || {}
        }
      };

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Get health endpoint URL for an agent
   */
  private getHealthEndpoint(agent: AgentRegistration): string {
    const baseUrl = agent.endpoint;
    
    // Try common health endpoint patterns
    const healthPaths = [
      '/health',
      '/healthz',
      '/ready',
      '/live',
      '/status',
      '/ping'
    ];

    // For now, assume /health endpoint
    // In a real implementation, you might want to discover the actual health endpoint
    return `${baseUrl}/health`;
  }

  /**
   * Determine health status based on response data and response time
   */
  private determineHealthStatus(healthData: any, responseTime: number): 'healthy' | 'unhealthy' | 'degraded' | 'unknown' {
    // Check if agent reports its own status
    if (healthData.status) {
      return healthData.status;
    }

    // Determine status based on response time
    if (responseTime < 1000) {
      return 'healthy';
    } else if (responseTime < 5000) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Store health check result in history
   */
  private storeHealthResult(agentId: string, result: HealthCheckResult): void {
    if (!this.healthHistory.has(agentId)) {
      this.healthHistory.set(agentId, []);
    }

    const history = this.healthHistory.get(agentId)!;
    history.push(result);

    // Keep only last 100 results
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Update agent health in discovery service
   */
  private async updateAgentHealth(agentId: string, result: HealthCheckResult): Promise<void> {
    const agent = await this.discoveryService.getAgentById(agentId);
    if (!agent) {
      return;
    }

    const previousStatus = agent.health.status;
    
    const health: AgentHealth = {
      status: result.status,
      lastHeartbeat: result.timestamp,
      responseTime: result.responseTime,
      errorCount: result.status === 'unhealthy' ? agent.health.errorCount + 1 : 0,
      uptime: agent.health.uptime + this.config.interval,
      resourceUsage: result.details.resourceUsage || agent.health.resourceUsage,
      customMetrics: {
        ...agent.health.customMetrics,
        lastHealthCheck: result.timestamp.toISOString(),
        healthCheckLatency: result.responseTime
      }
    };

    await this.discoveryService.updateAgentHealth(agentId, health);

    // Emit status change event if status changed
    if (previousStatus !== result.status) {
      this.emitEvent({
        type: 'health_status_changed',
        agentId,
        timestamp: new Date(),
        data: {
          previousStatus,
          newStatus: result.status,
          health
        }
      });

      // Emit specific events for unhealthy/recovery
      if (result.status === 'unhealthy') {
        this.emitEvent({
          type: 'agent_unhealthy',
          agentId,
          timestamp: new Date(),
          data: { health, error: result.error }
        });
      } else if (previousStatus === 'unhealthy' && result.status === 'healthy') {
        this.emitEvent({
          type: 'agent_recovered',
          agentId,
          timestamp: new Date(),
          data: { health }
        });
      }
    }
  }

  /**
   * Get health history for an agent
   */
  getHealthHistory(agentId: string, limit: number = 50): HealthCheckResult[] {
    const history = this.healthHistory.get(agentId) || [];
    return history.slice(-limit);
  }

  /**
   * Get health statistics for an agent
   */
  getHealthStatistics(agentId: string): {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    averageResponseTime: number;
    uptime: number;
    lastCheck: Date | null;
  } {
    const history = this.healthHistory.get(agentId) || [];
    
    if (history.length === 0) {
      return {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        averageResponseTime: 0,
        uptime: 0,
        lastCheck: null
      };
    }

    const successfulChecks = history.filter(h => h.status === 'healthy').length;
    const failedChecks = history.filter(h => h.status === 'unhealthy').length;
    const averageResponseTime = history.reduce((sum, h) => sum + h.responseTime, 0) / history.length;

    const lastCheck = history[history.length - 1]?.timestamp || null;
    const firstCheck = history[0]?.timestamp;
    const uptime = firstCheck && lastCheck ? lastCheck.getTime() - firstCheck.getTime() : 0;

    return {
      totalChecks: history.length,
      successfulChecks,
      failedChecks,
      averageResponseTime,
      uptime,
      lastCheck
    };
  }

  /**
   * Add event listener
   */
  onEvent(listener: (event: HealthCheckEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  offEvent(listener: (event: HealthCheckEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: HealthCheckEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in health check event listener:', error);
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if health checking is running
   */
  isHealthCheckingRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get all agents being monitored
   */
  getMonitoredAgents(): string[] {
    return Array.from(this.healthChecks.keys());
  }
} 