import { RegistrationProtocol, RegistrationRequest, HeartbeatRequest, DeregistrationRequest } from '../registration-protocol';
import { AgentHealth } from '../types';

describe('RegistrationProtocol', () => {
  const validMetadata = {
    id: 'test-agent-1',
    name: 'Test Agent',
    description: 'A test agent',
    version: '1.0.0',
    author: 'Test Author',
    license: 'MIT',
    repository: 'https://github.com/test/agent',
    documentation: 'https://docs.test/agent',
    tags: ['test', 'example'],
    capabilities: [
      {
        id: 'cap-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'test',
        tags: ['test'],
        parameters: {},
        returnType: 'string',
        examples: ['example']
      }
    ],
    dependencies: [],
    requirements: {
      cpu: '1',
      memory: '512MB',
      storage: '1GB'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validRequest: RegistrationRequest = {
    metadata: validMetadata,
    endpoint: 'http://localhost:3000',
    protocol: 'http'
  };

  describe('validateRegistrationRequest', () => {
    test('should validate a valid registration request', () => {
      const result = RegistrationProtocol.validateRegistrationRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request without metadata', () => {
      const request = { ...validRequest, metadata: undefined as any };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata is required');
    });

    test('should reject request with empty agent ID', () => {
      const request = {
        ...validRequest,
        metadata: { ...validMetadata, id: '' }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent ID is required');
    });

    test('should reject request with empty agent name', () => {
      const request = {
        ...validRequest,
        metadata: { ...validMetadata, name: '' }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent name is required');
    });

    test('should reject request with empty version', () => {
      const request = {
        ...validRequest,
        metadata: { ...validMetadata, version: '' }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent version is required');
    });

    test('should reject request with empty author', () => {
      const request = {
        ...validRequest,
        metadata: { ...validMetadata, author: '' }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent author is required');
    });

    test('should reject request without capabilities', () => {
      const request = {
        ...validRequest,
        metadata: { ...validMetadata, capabilities: [] }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one capability is required');
    });

    test('should reject request without endpoint', () => {
      const request = { ...validRequest, endpoint: '' };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Endpoint is required');
    });

    test('should reject request with invalid endpoint URL', () => {
      const request = { ...validRequest, endpoint: 'invalid-url' };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid endpoint URL format');
    });

    test('should reject request with invalid protocol', () => {
      const request = { ...validRequest, protocol: 'invalid' as any };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Valid protocol is required (http, https, grpc, websocket)');
    });

    test('should accept all valid protocols', () => {
      const protocols = ['http', 'https', 'grpc', 'websocket'];
      protocols.forEach(protocol => {
        const request = { ...validRequest, protocol: protocol as any };
        const result = RegistrationProtocol.validateRegistrationRequest(request);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject invalid authentication type', () => {
      const request = {
        ...validRequest,
        authentication: { type: 'invalid' as any }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid authentication type');
    });

    test('should accept all valid authentication types', () => {
      const authTypes = ['none', 'api_key', 'jwt', 'oauth'] as const;
      authTypes.forEach(type => {
        const auth = type === 'none' 
          ? { type } 
          : { type, credentials: { key: 'test' } };
        const request = {
          ...validRequest,
          authentication: auth
        };
        const result = RegistrationProtocol.validateRegistrationRequest(request);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject non-none auth without credentials', () => {
      const request = {
        ...validRequest,
        authentication: { type: 'api_key' as const }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Credentials are required for non-none authentication types');
    });

    test('should validate load balancing weight range', () => {
      const request = {
        ...validRequest,
        loadBalancing: { weight: -1 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Load balancing weight must be between 0 and 100');

      const request2 = {
        ...validRequest,
        loadBalancing: { weight: 101 }
      };
      const result2 = RegistrationProtocol.validateRegistrationRequest(request2);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Load balancing weight must be between 0 and 100');
    });

    test('should validate max connections', () => {
      const request = {
        ...validRequest,
        loadBalancing: { maxConnections: 0 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max connections must be greater than 0');
    });

    test('should validate timeout', () => {
      const request = {
        ...validRequest,
        loadBalancing: { timeout: 0 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timeout must be greater than 0');
    });

    test('should validate scaling min instances', () => {
      const request = {
        ...validRequest,
        scaling: { minInstances: -1 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Min instances must be non-negative');
    });

    test('should validate scaling max instances', () => {
      const request = {
        ...validRequest,
        scaling: { maxInstances: 0 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Max instances must be greater than 0');
    });

    test('should validate min instances <= max instances', () => {
      const request = {
        ...validRequest,
        scaling: { minInstances: 5, maxInstances: 3 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Min instances cannot be greater than max instances');
    });

    test('should validate CPU utilization range', () => {
      const request = {
        ...validRequest,
        scaling: { targetCPUUtilization: -1 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Target CPU utilization must be between 0 and 100');

      const request2 = {
        ...validRequest,
        scaling: { targetCPUUtilization: 101 }
      };
      const result2 = RegistrationProtocol.validateRegistrationRequest(request2);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Target CPU utilization must be between 0 and 100');
    });

    test('should validate memory utilization range', () => {
      const request = {
        ...validRequest,
        scaling: { targetMemoryUtilization: -1 }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Target memory utilization must be between 0 and 100');

      const request2 = {
        ...validRequest,
        scaling: { targetMemoryUtilization: 101 }
      };
      const result2 = RegistrationProtocol.validateRegistrationRequest(request2);
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Target memory utilization must be between 0 and 100');
    });

    test('should generate warnings for no authentication', () => {
      const result = RegistrationProtocol.validateRegistrationRequest(validRequest);
      expect(result.warnings).toContain('No authentication configured - agent will be accessible without authentication');
    });

    test('should generate warnings for default namespace', () => {
      const result = RegistrationProtocol.validateRegistrationRequest(validRequest);
      expect(result.warnings).toContain('Agent will run in default namespace - consider using a dedicated namespace for isolation');
    });

    test('should not generate warnings with custom namespace', () => {
      const request = {
        ...validRequest,
        isolation: { namespace: 'custom-namespace' }
      };
      const result = RegistrationProtocol.validateRegistrationRequest(request);
      expect(result.warnings).not.toContain('Agent will run in default namespace - consider using a dedicated namespace for isolation');
    });
  });

  describe('createAgentRegistration', () => {
    test('should create registration with all required fields', () => {
      const registration = RegistrationProtocol.createAgentRegistration(validRequest);
      expect(registration.id).toBe(validRequest.metadata.id);
      expect(registration.metadata).toEqual({
        ...validRequest.metadata,
        createdAt: registration.metadata.createdAt,
        updatedAt: registration.metadata.updatedAt
      });
      expect(registration.endpoint).toBe(validRequest.endpoint);
      expect(registration.protocol).toBe(validRequest.protocol);
    });

    test('should set default authentication to none', () => {
      const registration = RegistrationProtocol.createAgentRegistration(validRequest);
      expect(registration.authentication).toEqual({ type: 'none' });
    });

    test('should use provided authentication', () => {
      const request = {
        ...validRequest,
        authentication: { type: 'api_key', credentials: { key: 'test' } }
      };
      const registration = RegistrationProtocol.createAgentRegistration(request);
      expect(registration.authentication).toEqual(request.authentication);
    });

    test('should merge load balancing defaults', () => {
      const request = {
        ...validRequest,
        loadBalancing: { weight: 50 }
      };
      const registration = RegistrationProtocol.createAgentRegistration(request);
      expect(registration.loadBalancing.weight).toBe(50);
      expect(registration.loadBalancing.maxConnections).toBe(100); // default
      expect(registration.loadBalancing.timeout).toBe(30000); // default
    });

    test('should merge isolation defaults', () => {
      const request = {
        ...validRequest,
        isolation: { namespace: 'custom' }
      };
      const registration = RegistrationProtocol.createAgentRegistration(request);
      expect(registration.isolation.namespace).toBe('custom');
      expect(registration.isolation.resourceLimits).toEqual({}); // default
      expect(registration.isolation.securityContext).toEqual({}); // default
    });

    test('should merge scaling defaults', () => {
      const request = {
        ...validRequest,
        scaling: { minInstances: 2 }
      };
      const registration = RegistrationProtocol.createAgentRegistration(request);
      expect(registration.scaling.minInstances).toBe(2);
      expect(registration.scaling.maxInstances).toBe(10); // default
      expect(registration.scaling.targetCPUUtilization).toBe(70); // default
      expect(registration.scaling.targetMemoryUtilization).toBe(80); // default
    });

    test('should set health status to unknown', () => {
      const registration = RegistrationProtocol.createAgentRegistration(validRequest);
      expect(registration.health.status).toBe('unknown');
      expect(registration.health.responseTime).toBe(0);
      expect(registration.health.errorCount).toBe(0);
      expect(registration.health.uptime).toBe(0);
    });
  });

  describe('validateHeartbeatRequest', () => {
    const validHealth: AgentHealth = {
      status: 'healthy',
      lastHeartbeat: new Date(),
      responseTime: 100,
      errorCount: 0,
      uptime: 3600,
      resourceUsage: {
        cpu: 50,
        memory: 60,
        disk: 30,
        network: 20
      },
      customMetrics: {}
    };

    const validHeartbeat: HeartbeatRequest = {
      agentId: 'test-agent-1',
      health: validHealth,
      timestamp: new Date()
    };

    test('should validate a valid heartbeat request', () => {
      const result = RegistrationProtocol.validateHeartbeatRequest(validHeartbeat);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request without agent ID', () => {
      const request = { ...validHeartbeat, agentId: '' };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent ID is required');
    });

    test('should reject request without health data', () => {
      const request = { ...validHeartbeat, health: undefined as any };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Health data is required');
    });

    test('should reject request with invalid health status', () => {
      const request = {
        ...validHeartbeat,
        health: { ...validHealth, status: 'invalid' as any }
      };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid health status');
    });

    test('should accept all valid health statuses', () => {
      const statuses = ['healthy', 'unhealthy', 'degraded', 'unknown'];
      statuses.forEach(status => {
        const request = {
          ...validHeartbeat,
          health: { ...validHealth, status: status as any }
        };
        const result = RegistrationProtocol.validateHeartbeatRequest(request);
        expect(result.isValid).toBe(true);
      });
    });

    test('should reject request without last heartbeat', () => {
      const request = {
        ...validHeartbeat,
        health: { ...validHealth, lastHeartbeat: undefined as any }
      };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Last heartbeat timestamp is required');
    });

    test('should reject request with negative response time', () => {
      const request = {
        ...validHeartbeat,
        health: { ...validHealth, responseTime: -1 }
      };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Response time cannot be negative');
    });

    test('should reject request with negative error count', () => {
      const request = {
        ...validHeartbeat,
        health: { ...validHealth, errorCount: -1 }
      };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Error count cannot be negative');
    });

    test('should reject request with negative uptime', () => {
      const request = {
        ...validHeartbeat,
        health: { ...validHealth, uptime: -1 }
      };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Uptime cannot be negative');
    });

    test('should reject request without timestamp', () => {
      const request = { ...validHeartbeat, timestamp: undefined as any };
      const result = RegistrationProtocol.validateHeartbeatRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Timestamp is required');
    });
  });

  describe('validateDeregistrationRequest', () => {
    const validDeregistration: DeregistrationRequest = {
      agentId: 'test-agent-1',
      reason: 'Testing'
    };

    test('should validate a valid deregistration request', () => {
      const result = RegistrationProtocol.validateDeregistrationRequest(validDeregistration);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should reject request without agent ID', () => {
      const request = { ...validDeregistration, agentId: '' };
      const result = RegistrationProtocol.validateDeregistrationRequest(request);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Agent ID is required');
    });

    test('should accept request without reason', () => {
      const request = { agentId: 'test-agent-1' };
      const result = RegistrationProtocol.validateDeregistrationRequest(request);
      expect(result.isValid).toBe(true);
    });
  });

  describe('generateAgentId', () => {
    test('should generate unique agent IDs', () => {
      const id1 = RegistrationProtocol.generateAgentId();
      const id2 = RegistrationProtocol.generateAgentId();
      expect(id1).not.toBe(id2);
    });

    test('should use provided prefix', () => {
      const id = RegistrationProtocol.generateAgentId('custom');
      expect(id).toMatch(/^custom-/);
    });

    test('should use default prefix when none provided', () => {
      const id = RegistrationProtocol.generateAgentId();
      expect(id).toMatch(/^agent-/);
    });

    test('should include timestamp and random components', () => {
      const id = RegistrationProtocol.generateAgentId('test');
      const parts = id.split('-');
      expect(parts.length).toBeGreaterThan(2);
      expect(parts[0]).toBe('test');
    });
  });

  describe('calculateHeartbeatInterval', () => {
    const baseInterval = 30000;

    test('should return base interval for healthy status', () => {
      const health: AgentHealth = {
        status: 'healthy',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(baseInterval);
    });

    test('should reduce interval for degraded status', () => {
      const health: AgentHealth = {
        status: 'degraded',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(baseInterval * 0.5);
    });

    test('should reduce interval for unhealthy status', () => {
      const health: AgentHealth = {
        status: 'unhealthy',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(baseInterval * 0.25);
    });

    test('should reduce interval for unknown status', () => {
      const health: AgentHealth = {
        status: 'unknown',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(baseInterval * 0.5);
    });

    test('should reduce interval for high error count', () => {
      const health: AgentHealth = {
        status: 'healthy',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 15,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(Math.max(baseInterval * 0.5, 5000));
    });

    test('should increase interval for high response time', () => {
      const health: AgentHealth = {
        status: 'healthy',
        lastHeartbeat: new Date(),
        responseTime: 2000,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBe(Math.max(baseInterval * 1.5, baseInterval));
    });

    test('should combine multiple factors', () => {
      const health: AgentHealth = {
        status: 'degraded',
        lastHeartbeat: new Date(),
        responseTime: 2000,
        errorCount: 15,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBeGreaterThan(0);
      // The interval should be adjusted based on multiple factors, but may not always be less than baseInterval
      expect(interval).toBeLessThanOrEqual(baseInterval * 1.5);
    });

    test('should respect minimum interval of 5 seconds', () => {
      const health: AgentHealth = {
        status: 'unhealthy',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 20,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, baseInterval);
      expect(interval).toBeGreaterThanOrEqual(5000);
    });

    test('should round the result', () => {
      const health: AgentHealth = {
        status: 'healthy',
        lastHeartbeat: new Date(),
        responseTime: 100,
        errorCount: 0,
        uptime: 3600,
        resourceUsage: { cpu: 50, memory: 60, disk: 30, network: 20 },
        customMetrics: {}
      };
      const interval = RegistrationProtocol.calculateHeartbeatInterval(health, 10000);
      expect(Number.isInteger(interval)).toBe(true);
    });
  });
}); 