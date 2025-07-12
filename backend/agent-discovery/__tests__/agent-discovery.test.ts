import { 
  AgentDiscoveryService, 
  AgentHealthChecker, 
  CapabilityRegistry, 
  AgentLifecycleManager 
} from '../index';
import { 
  AgentRegistration, 
  AgentCapability, 
  AgentHealth
} from '../types';
import { RegistrationRequest } from '../registration-protocol';
import { RegistrationProtocol } from '../registration-protocol';

describe('Agent Discovery & Registration System', () => {
  let discoveryService: AgentDiscoveryService;
  let healthChecker: AgentHealthChecker;
  let capabilityRegistry: CapabilityRegistry;
  let lifecycleManager: AgentLifecycleManager;

  const mockAgent: AgentRegistration = {
    id: 'test-agent-1',
    metadata: {
      id: 'test-agent-1',
      name: 'Test Agent',
      description: 'A test agent for unit testing',
      version: '1.0.0',
      author: 'Test Author',
      license: 'MIT',
      repository: 'https://github.com/test/agent',
      documentation: 'https://docs.test/agent',
      tags: ['test', 'unit'],
      capabilities: [
        {
          id: 'test-capability-1',
          name: 'Test Capability',
          description: 'A test capability',
          version: '1.0.0',
          category: 'testing',
          tags: ['test'],
          parameters: {},
          returnType: 'string',
          examples: ['example1', 'example2']
        }
      ],
      dependencies: [],
      requirements: {
        cpu: '100m',
        memory: '128Mi',
        storage: '1Gi'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    health: {
      status: 'healthy',
      lastHeartbeat: new Date(),
      responseTime: 100,
      errorCount: 0,
      uptime: 3600,
      resourceUsage: {
        cpu: 10,
        memory: 50,
        disk: 20,
        network: 5
      },
      customMetrics: {}
    },
    endpoint: 'http://localhost:8080',
    protocol: 'http',
    authentication: { type: 'none' },
    loadBalancing: {
      weight: 1,
      maxConnections: 100,
      timeout: 30000
    },
    isolation: {
      namespace: 'default',
      resourceLimits: {},
      securityContext: {}
    },
    scaling: {
      minInstances: 1,
      maxInstances: 10,
      targetCPUUtilization: 70,
      targetMemoryUtilization: 80
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  beforeEach(() => {
    discoveryService = new AgentDiscoveryService();
    healthChecker = new AgentHealthChecker(discoveryService);
    capabilityRegistry = new CapabilityRegistry();
    lifecycleManager = new AgentLifecycleManager(discoveryService);
  });

  describe('AgentDiscoveryService', () => {
    it('should register an agent successfully', async () => {
      await discoveryService.registerAgent(mockAgent);
      
      const registeredAgent = await discoveryService.getAgentById(mockAgent.id);
      expect(registeredAgent).toBeDefined();
      expect(registeredAgent!.id).toBe(mockAgent.id);
    });

    it('should reject duplicate agent registration', async () => {
      await discoveryService.registerAgent(mockAgent);
      
      await expect(discoveryService.registerAgent(mockAgent))
        .rejects.toThrow('Registration conflicts detected');
    });

    it('should discover agents by capability', async () => {
      await discoveryService.registerAgent(mockAgent);
      
      const result = await discoveryService.searchByCapability('test-capability-1');
      expect(result).toBeDefined();
      expect(result!.agents).toHaveLength(1);
      expect(result!.agents[0].id).toBe(mockAgent.id);
    });

    it('should discover agents by query', async () => {
      await discoveryService.registerAgent(mockAgent);
      
      const result = await discoveryService.discoverAgents({
        capabilities: ['test-capability-1'],
        limit: 10
      });
      
      expect(result.agents).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should update agent health', async () => {
      await discoveryService.registerAgent(mockAgent);
      
      const newHealth: AgentHealth = {
        ...mockAgent.health,
        status: 'degraded',
        responseTime: 500
      };
      
      await discoveryService.updateAgentHealth(mockAgent.id, newHealth);
      
      const updatedAgent = await discoveryService.getAgentById(mockAgent.id);
      expect(updatedAgent!.health.status).toBe('degraded');
      expect(updatedAgent!.health.responseTime).toBe(500);
    });

    it('should deregister an agent', async () => {
      await discoveryService.registerAgent(mockAgent);
      await discoveryService.deregisterAgent(mockAgent.id);
      
      const agent = await discoveryService.getAgentById(mockAgent.id);
      expect(agent).toBeNull();
    });

    it('should get agent statistics', async () => {
      const healthyAgent = { ...mockAgent, health: { ...mockAgent.health, status: 'healthy' as 'healthy' } };
      await discoveryService.registerAgent(healthyAgent);
      
      const stats = await discoveryService.getAgentStatistics();
      expect(stats.total).toBe(1);
      expect(stats.healthy).toBe(1);
    });
  });

  describe('RegistrationProtocol', () => {
    it('should validate valid registration request', () => {
      const request: RegistrationRequest = {
        metadata: mockAgent.metadata,
        endpoint: mockAgent.endpoint,
        protocol: mockAgent.protocol,
        authentication: mockAgent.authentication,
        loadBalancing: mockAgent.loadBalancing,
        isolation: mockAgent.isolation,
        scaling: mockAgent.scaling
      };

      const validation = RegistrationProtocol.validateRegistrationRequest(request);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid registration request', () => {
      const invalidRequest: RegistrationRequest = {
        metadata: {
          ...mockAgent.metadata,
          id: '', // Invalid: empty ID
          capabilities: [] // Invalid: no capabilities
        },
        endpoint: 'invalid-url', // Invalid URL
        protocol: 'http',
        authentication: { type: 'none' }
      };

      const validation = RegistrationProtocol.validateRegistrationRequest(invalidRequest);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should create agent registration from request', () => {
      const request: RegistrationRequest = {
        metadata: mockAgent.metadata,
        endpoint: mockAgent.endpoint,
        protocol: mockAgent.protocol,
        authentication: mockAgent.authentication
      };

      const registration = RegistrationProtocol.createAgentRegistration(request);
      expect(registration.id).toBe(mockAgent.metadata.id);
      expect(registration.endpoint).toBe(mockAgent.endpoint);
      expect(registration.protocol).toBe(mockAgent.protocol);
    });

    it('should generate unique agent ID', () => {
      const id1 = RegistrationProtocol.generateAgentId('test');
      const id2 = RegistrationProtocol.generateAgentId('test');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^test-/);
    });
  });

  describe('CapabilityRegistry', () => {
    it('should register a capability', async () => {
      const capability: AgentCapability = {
        id: 'test-capability-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'testing',
        tags: ['test'],
        parameters: {},
        returnType: 'string',
        examples: []
      };

      await capabilityRegistry.registerCapability('test-agent-1', capability);
      
      const registeredCapability = await capabilityRegistry.getCapability('test-capability-1');
      expect(registeredCapability).toBeDefined();
      expect(registeredCapability!.id).toBe('test-capability-1');
    });

    it('should handle multiple versions of the same capability', async () => {
      const capability1: AgentCapability = {
        id: 'test-capability-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'testing',
        tags: ['test'],
        parameters: {},
        returnType: 'string',
        examples: []
      };

      const capability2: AgentCapability = {
        ...capability1,
        version: '2.0.0'
      };

      await capabilityRegistry.registerCapability('agent-1', capability1);
      await capabilityRegistry.registerCapability('agent-2', capability2);
      
      const capability = await capabilityRegistry.getCapability('test-capability-1');
      expect(capability).toBeDefined();
      expect(capability!.versions).toHaveLength(2);
      expect(capability!.latestVersion).toBe('2.0.0');
    });

    it('should search capabilities', async () => {
      const capability: AgentCapability = {
        id: 'test-capability-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'testing',
        tags: ['test'],
        parameters: {},
        returnType: 'string',
        examples: []
      };

      await capabilityRegistry.registerCapability('test-agent-1', capability);
      
      const result = await capabilityRegistry.searchCapabilities({
        category: 'testing',
        limit: 10
      });
      
      expect(result.capabilities).toHaveLength(1);
      expect(result.capabilities[0].id).toBe('test-capability-1');
    });

    it('should get agents for capability', async () => {
      const capability: AgentCapability = {
        id: 'test-capability-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'testing',
        tags: ['test'],
        parameters: {},
        returnType: 'string',
        examples: []
      };

      await capabilityRegistry.registerCapability('agent-1', capability);
      await capabilityRegistry.registerCapability('agent-2', capability);
      
      const agents = await capabilityRegistry.getAgentsForCapability('test-capability-1');
      expect(agents).toHaveLength(2);
      expect(agents).toContain('agent-1');
      expect(agents).toContain('agent-2');
    });
  });

  describe('AgentLifecycleManager', () => {
    it('should initialize agent lifecycle', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      
      const state = lifecycleManager.getLifecycleState('test-agent-1');
      expect(state).toBe('registered');
    });

    it('should deploy an agent', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      
      const deployment = await lifecycleManager.deployAgent('test-agent-1', '1.0.0');
      
      expect(deployment.agentId).toBe('test-agent-1');
      expect(deployment.version).toBe('1.0.0');
      expect(deployment.status).toBe('running');
      
      const state = lifecycleManager.getLifecycleState('test-agent-1');
      expect(state).toBe('running');
    });

    it('should scale an agent', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      await lifecycleManager.deployAgent('test-agent-1', '1.0.0');
      
      await lifecycleManager.scaleAgent('test-agent-1', 3);
      
      const state = lifecycleManager.getLifecycleState('test-agent-1');
      expect(state).toBe('running');
    });

    it('should rollback an agent', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      await lifecycleManager.deployAgent('test-agent-1', '2.0.0');
      
      const rollback = await lifecycleManager.rollbackAgent('test-agent-1', '1.0.0', 'Test rollback');
      
      expect(rollback.fromVersion).toBe('2.0.0');
      expect(rollback.toVersion).toBe('1.0.0');
      expect(rollback.status).toBe('completed');
    });

    it('should stop an agent', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      await lifecycleManager.deployAgent('test-agent-1', '1.0.0');
      
      await lifecycleManager.stopAgent('test-agent-1');
      
      const state = lifecycleManager.getLifecycleState('test-agent-1');
      expect(state).toBe('stopped');
    });

    it('should deregister an agent', async () => {
      await lifecycleManager.initializeAgent('test-agent-1');
      await lifecycleManager.deregisterAgent('test-agent-1');
      
      const state = lifecycleManager.getLifecycleState('test-agent-1');
      expect(state).toBe('initializing'); // After deregistration, state is removed
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete agent lifecycle', async () => {
      // Register agent
      await discoveryService.registerAgent(mockAgent);
      
      // Register capabilities
      for (const capability of mockAgent.metadata.capabilities) {
        await capabilityRegistry.registerCapability(mockAgent.id, capability);
      }
      
      // Initialize lifecycle
      await lifecycleManager.initializeAgent(mockAgent.id);
      
      // Deploy agent
      const deployment = await lifecycleManager.deployAgent(mockAgent.id, mockAgent.metadata.version);
      expect(deployment.status).toBe('running');
      
      // Update health
      const newHealth: AgentHealth = {
        ...mockAgent.health,
        status: 'healthy',
        responseTime: 50
      };
      await discoveryService.updateAgentHealth(mockAgent.id, newHealth);
      
      // Verify agent is discoverable
      const discoveredAgent = await discoveryService.getAgentById(mockAgent.id);
      expect(discoveredAgent).toBeDefined();
      expect(discoveredAgent!.health.status).toBe('healthy');
      
      // Verify capability is registered
      const capability = await capabilityRegistry.getCapability('test-capability-1');
      expect(capability).toBeDefined();
      
      // Stop and deregister
      await lifecycleManager.stopAgent(mockAgent.id);
      await lifecycleManager.deregisterAgent(mockAgent.id);
      await discoveryService.deregisterAgent(mockAgent.id);
      
      // Verify cleanup
      const agent = await discoveryService.getAgentById(mockAgent.id);
      expect(agent).toBeNull();
    });
  });
}); 