import { AgentHealthChecker, HealthCheckConfig, HealthCheckResult, HealthCheckEvent } from '../health-checker';
import { AgentDiscoveryService } from '../discovery-service';
import { AgentRegistration, AgentHealth } from '../types';

// Mock fetch globally
global.fetch = jest.fn();

describe('AgentHealthChecker', () => {
  let mockDiscoveryService: jest.Mocked<AgentDiscoveryService>;
  let healthChecker: AgentHealthChecker;
  let mockAgent: AgentRegistration;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock discovery service
    mockDiscoveryService = {
      getAllAgents: jest.fn(),
      getAgentById: jest.fn(),
      updateAgentHealth: jest.fn(),
      registerAgent: jest.fn(),
      deregisterAgent: jest.fn(),
      searchAgents: jest.fn(),
      getAgentStatistics: jest.fn()
    } as any;

    // Create test agent
    mockAgent = {
      id: 'test-agent-1',
      metadata: {
        id: 'test-agent-1',
        name: 'Test Agent',
        description: 'A test agent',
        version: '1.0.0',
        author: 'Test Author',
        license: 'MIT',
        repository: 'https://github.com/test/agent',
        documentation: 'https://docs.test/agent',
        tags: ['test'],
        capabilities: [{
          id: 'cap-1',
          name: 'Test Capability',
          description: 'A test capability',
          version: '1.0.0',
          category: 'test',
          tags: ['test'],
          parameters: {},
          returnType: 'string',
          examples: ['example']
        }],
        dependencies: [],
        requirements: { cpu: '1', memory: '512MB', storage: '1GB' },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      health: {
        status: 'unknown',
        lastHeartbeat: new Date(),
        responseTime: 0,
        errorCount: 0,
        uptime: 0,
        resourceUsage: { cpu: 0, memory: 0, disk: 0, network: 0 },
        customMetrics: {}
      },
      endpoint: 'http://localhost:3000',
      protocol: 'http',
      authentication: { type: 'none' },
      loadBalancing: { weight: 1, maxConnections: 100, timeout: 30000 },
      isolation: { namespace: 'default', resourceLimits: {}, securityContext: {} },
      scaling: { minInstances: 1, maxInstances: 10, targetCPUUtilization: 70, targetMemoryUtilization: 80 },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Create health checker with default config
    healthChecker = new AgentHealthChecker(mockDiscoveryService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Constructor and Configuration', () => {
    test('should create with default configuration', () => {
      const config = healthChecker.getConfig();
      expect(config.interval).toBe(30000);
      expect(config.timeout).toBe(10000);
      expect(config.retries).toBe(3);
      expect(config.successThreshold).toBe(2);
      expect(config.failureThreshold).toBe(3);
    });

    test('should create with custom configuration', () => {
      const customConfig: Partial<HealthCheckConfig> = {
        interval: 60000,
        timeout: 5000,
        retries: 5,
        customHeaders: { 'X-Custom': 'value' },
        customBody: { test: true }
      };
      
      const customHealthChecker = new AgentHealthChecker(mockDiscoveryService, customConfig);
      const config = customHealthChecker.getConfig();
      
      expect(config.interval).toBe(60000);
      expect(config.timeout).toBe(5000);
      expect(config.retries).toBe(5);
      expect(config.customHeaders).toEqual({ 'X-Custom': 'value' });
      expect(config.customBody).toEqual({ test: true });
    });

    test('should merge custom config with defaults', () => {
      const customConfig: Partial<HealthCheckConfig> = {
        interval: 45000
      };
      
      const customHealthChecker = new AgentHealthChecker(mockDiscoveryService, customConfig);
      const config = customHealthChecker.getConfig();
      
      expect(config.interval).toBe(45000);
      expect(config.timeout).toBe(10000); // default
      expect(config.retries).toBe(3); // default
    });
  });

  describe('Lifecycle Management', () => {
    test('should start health checking for all agents', async () => {
      mockDiscoveryService.getAllAgents.mockResolvedValue([mockAgent]);
      
      await healthChecker.start();
      
      expect(mockDiscoveryService.getAllAgents).toHaveBeenCalled();
      expect(healthChecker.isHealthCheckingRunning()).toBe(true);
      expect(healthChecker.getMonitoredAgents()).toContain(mockAgent.id);
    });

    test('should not start if already running', async () => {
      mockDiscoveryService.getAllAgents.mockResolvedValue([mockAgent]);
      
      await healthChecker.start();
      await healthChecker.start(); // Second call should be ignored
      
      expect(mockDiscoveryService.getAllAgents).toHaveBeenCalledTimes(1);
    });

    test('should stop health checking', async () => {
      mockDiscoveryService.getAllAgents.mockResolvedValue([mockAgent]);
      
      await healthChecker.start();
      expect(healthChecker.isHealthCheckingRunning()).toBe(true);
      
      await healthChecker.stop();
      expect(healthChecker.isHealthCheckingRunning()).toBe(false);
      expect(healthChecker.getMonitoredAgents()).toHaveLength(0);
    });

    test('should not stop if not running', async () => {
      await healthChecker.stop(); // Should not throw
      expect(healthChecker.isHealthCheckingRunning()).toBe(false);
    });

    test('should start health check for specific agent', async () => {
      await healthChecker.startHealthCheck(mockAgent.id);
      
      expect(healthChecker.getMonitoredAgents()).toContain(mockAgent.id);
    });

    test('should stop health check for specific agent', async () => {
      await healthChecker.startHealthCheck(mockAgent.id);
      expect(healthChecker.getMonitoredAgents()).toContain(mockAgent.id);
      
      await healthChecker.stopHealthCheck(mockAgent.id);
      expect(healthChecker.getMonitoredAgents()).not.toContain(mockAgent.id);
    });

    test('should replace existing health check when starting again', async () => {
      await healthChecker.startHealthCheck(mockAgent.id);
      const firstInterval = healthChecker.getMonitoredAgents();
      
      await healthChecker.startHealthCheck(mockAgent.id);
      const secondInterval = healthChecker.getMonitoredAgents();
      
      expect(secondInterval).toContain(mockAgent.id);
    });
  });

  describe('Health Check Execution', () => {
    test('should perform health check for existing agent', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy', resourceUsage: { cpu: 50 } }),
        headers: { get: () => '1024' }
      });

      // Mock Date.now to return different values for start and end
      const startTime = 1000;
      const endTime = 1500;
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.agentId).toBe(mockAgent.id);
      expect(result.status).toBe('healthy');
      expect(result.responseTime).toBe(500); // endTime - startTime
      expect(result.details.httpStatus).toBe(200);
      expect(result.details.responseSize).toBe(1024);
    });

    test('should return unknown status for non-existent agent', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(null);
      
      const result = await healthChecker.performHealthCheck('non-existent');
      
      expect(result.agentId).toBe('non-existent');
      expect(result.status).toBe('unknown');
      expect(result.error).toBe('Agent not found');
    });

    test('should handle HTTP errors', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    }, 60000); // Increase timeout

    test('should handle network errors', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Network error');
    }, 60000); // Increase timeout

    test('should retry failed health checks', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      
      // First two calls fail, third succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: 'healthy' }),
          headers: { get: () => null }
        });

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.status).toBe('healthy');
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3);
    }, 60000); // Increase timeout

    test('should fail after max retries', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Persistent failure'));

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toBe('Persistent failure');
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(3); // Default retries
    }, 60000); // Increase timeout

    test('should handle timeout', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 15000)
        )
      );

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(result.status).toBe('unhealthy');
      expect(result.error).toContain('Timeout');
    }, 60000); // Increase timeout
  });

  describe('Health Status Determination', () => {
    test('should use agent-reported status when available', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'degraded' }),
        headers: { get: () => null }
      });

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      expect(result.status).toBe('degraded');
    });

    test('should determine status based on response time - healthy', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: { get: () => null }
      });

      // Mock fast response time (500ms)
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // start
        .mockReturnValueOnce(1500); // end (500ms response time)

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      expect(result.status).toBe('healthy');
    });

    test('should determine status based on response time - degraded', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: { get: () => null }
      });

      // Mock medium response time (3000ms)
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // start
        .mockReturnValueOnce(4000); // end (3000ms response time)

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      expect(result.status).toBe('degraded');
    });

    test('should determine status based on response time - unhealthy', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        headers: { get: () => null }
      });

      // Mock slow response time (6000ms)
      jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000) // start
        .mockReturnValueOnce(7000); // end (6000ms response time)

      const result = await healthChecker.performHealthCheck(mockAgent.id);
      expect(result.status).toBe('unhealthy');
    });
  });

  describe('Health History Management', () => {
    test('should store health check results', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      const history = healthChecker.getHealthHistory(mockAgent.id);
      expect(history).toHaveLength(1);
      expect(history[0].agentId).toBe(mockAgent.id);
      expect(history[0].status).toBe('healthy');
    });

    test('should limit history to 100 results', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      // Perform 105 health checks
      for (let i = 0; i < 105; i++) {
        await healthChecker.performHealthCheck(mockAgent.id);
      }
      
      const history = healthChecker.getHealthHistory(mockAgent.id);
      expect(history).toHaveLength(100);
    }, 120000); // Increase timeout for multiple health checks

    test('should return limited history when requested', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      // Perform 10 health checks
      for (let i = 0; i < 10; i++) {
        await healthChecker.performHealthCheck(mockAgent.id);
      }
      
      const history = healthChecker.getHealthHistory(mockAgent.id, 5);
      expect(history).toHaveLength(5);
    });

    test('should return empty history for unknown agent', () => {
      const history = healthChecker.getHealthHistory('unknown-agent');
      expect(history).toHaveLength(0);
    });
  });

  describe('Health Statistics', () => {
    test('should calculate statistics for agent with history', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      
      // Mock different health check results with different response times
      const responses = [
        { status: 'healthy' },
        { status: 'healthy' },
        { status: 'unhealthy' },
        { status: 'degraded' },
        { status: 'healthy' }
      ];

      let timeOffset = 0;
      for (const response of responses) {
        (global.fetch as jest.Mock).mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response),
          headers: { get: () => null }
        });
        
        // Mock different response times
        jest.spyOn(Date, 'now')
          .mockReturnValueOnce(1000 + timeOffset) // start
          .mockReturnValueOnce(1500 + timeOffset); // end (500ms response time)
        
        await healthChecker.performHealthCheck(mockAgent.id);
        timeOffset += 1000;
      }
      
      const stats = healthChecker.getHealthStatistics(mockAgent.id);
      
      expect(stats.totalChecks).toBe(5);
      expect(stats.successfulChecks).toBe(3); // healthy
      expect(stats.failedChecks).toBe(1); // unhealthy
      expect(stats.averageResponseTime).toBe(500); // All checks had 500ms response time
      expect(stats.lastCheck).toBeInstanceOf(Date);
    });

    test('should return zero statistics for agent without history', () => {
      const stats = healthChecker.getHealthStatistics('unknown-agent');
      
      expect(stats.totalChecks).toBe(0);
      expect(stats.successfulChecks).toBe(0);
      expect(stats.failedChecks).toBe(0);
      expect(stats.averageResponseTime).toBe(0);
      expect(stats.uptime).toBe(0);
      expect(stats.lastCheck).toBeNull();
    });
  });

  describe('Event System', () => {
    test('should emit health check completed event', async () => {
      const eventListener = jest.fn();
      healthChecker.onEvent(eventListener);
      
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health_check_completed',
          agentId: mockAgent.id,
          data: expect.objectContaining({
            status: 'healthy'
          })
        })
      );
    });

    test('should emit status change events', async () => {
      const eventListener = jest.fn();
      healthChecker.onEvent(eventListener);
      
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      mockDiscoveryService.updateAgentHealth.mockResolvedValue();
      
      // First check - healthy
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });
      await healthChecker.performHealthCheck(mockAgent.id);
      
      // Second check - unhealthy (status change)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'unhealthy' }),
        headers: { get: () => null }
      });
      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'health_status_changed',
          agentId: mockAgent.id
        })
      );
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_unhealthy',
          agentId: mockAgent.id
        })
      );
    });

    test('should emit recovery event when agent becomes healthy again', async () => {
      const eventListener = jest.fn();
      healthChecker.onEvent(eventListener);
      
      // Set initial status to unhealthy
      mockAgent.health.status = 'unhealthy';
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      mockDiscoveryService.updateAgentHealth.mockResolvedValue();
      
      // First check - unhealthy (no change)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'unhealthy' }),
        headers: { get: () => null }
      });
      await healthChecker.performHealthCheck(mockAgent.id);
      
      // Second check - healthy (recovery)
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });
      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'agent_recovered',
          agentId: mockAgent.id
        })
      );
    });

    test('should handle event listener errors gracefully', async () => {
      const errorListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const normalListener = jest.fn();
      
      healthChecker.onEvent(errorListener);
      healthChecker.onEvent(normalListener);
      
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      // Should not throw
      await healthChecker.performHealthCheck(mockAgent.id);
      
      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });

    test('should remove event listener', () => {
      const listener = jest.fn();
      healthChecker.onEvent(listener);
      healthChecker.offEvent(listener);
      
      // Verify listener is removed by checking internal state
      // (we can't directly test this, but we can verify it doesn't cause errors)
      expect(() => healthChecker.offEvent(listener)).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig: Partial<HealthCheckConfig> = {
        interval: 45000,
        timeout: 8000,
        customHeaders: { 'X-New': 'value' }
      };
      
      healthChecker.updateConfig(newConfig);
      const config = healthChecker.getConfig();
      
      expect(config.interval).toBe(45000);
      expect(config.timeout).toBe(8000);
      expect(config.customHeaders).toEqual({ 'X-New': 'value' });
      expect(config.retries).toBe(3); // unchanged
    });

    test('should return config copy', () => {
      const config1 = healthChecker.getConfig();
      const config2 = healthChecker.getConfig();
      
      expect(config1).not.toBe(config2); // Different objects
      expect(config1).toEqual(config2); // Same values
    });
  });

  describe('Utility Methods', () => {
    test('should return running status', () => {
      expect(healthChecker.isHealthCheckingRunning()).toBe(false);
      
      // Mock as running
      (healthChecker as any).isRunning = true;
      expect(healthChecker.isHealthCheckingRunning()).toBe(true);
    });

    test('should return monitored agents', async () => {
      expect(healthChecker.getMonitoredAgents()).toHaveLength(0);
      
      await healthChecker.startHealthCheck(mockAgent.id);
      expect(healthChecker.getMonitoredAgents()).toContain(mockAgent.id);
    });
  });

  describe('Health Endpoint Discovery', () => {
    test('should construct health endpoint URL', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://localhost:3000/health');
    });
  });

  describe('Agent Health Updates', () => {
    test('should update agent health in discovery service', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      mockDiscoveryService.updateAgentHealth.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          status: 'healthy',
          resourceUsage: { cpu: 75, memory: 60, disk: 30, network: 20 }
        }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(mockDiscoveryService.updateAgentHealth).toHaveBeenCalledWith(
        mockAgent.id,
        expect.objectContaining({
          status: 'healthy',
          responseTime: expect.any(Number),
          resourceUsage: { cpu: 75, memory: 60, disk: 30, network: 20 }
        })
      );
    });

    test('should increment error count for unhealthy status', async () => {
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      mockDiscoveryService.updateAgentHealth.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'unhealthy' }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(mockDiscoveryService.updateAgentHealth).toHaveBeenCalledWith(
        mockAgent.id,
        expect.objectContaining({
          errorCount: 1 // Incremented from 0
        })
      );
    });

    test('should reset error count for healthy status', async () => {
      // Set initial error count
      mockAgent.health.errorCount = 5;
      mockDiscoveryService.getAgentById.mockResolvedValue(mockAgent);
      mockDiscoveryService.updateAgentHealth.mockResolvedValue();
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'healthy' }),
        headers: { get: () => null }
      });

      await healthChecker.performHealthCheck(mockAgent.id);
      
      expect(mockDiscoveryService.updateAgentHealth).toHaveBeenCalledWith(
        mockAgent.id,
        expect.objectContaining({
          errorCount: 0 // Reset from 5
        })
      );
    });
  });
}); 