import { AgentDiscoveryService } from '../discovery-service';
import { AgentRegistration } from '../types';

describe('AgentDiscoveryService', () => {
  let service: AgentDiscoveryService;
  const agent: AgentRegistration = {
    id: 'agent-1',
    metadata: {
      id: 'agent-1',
      name: 'Test Agent',
      description: 'A test agent',
      version: '1.0.0',
      author: 'Test Author',
      license: 'MIT',
      repository: '',
      documentation: '',
      tags: ['test'],
      capabilities: [{
        id: 'cap-1',
        name: 'Test Capability',
        description: 'A test capability',
        version: '1.0.0',
        category: 'test',
        tags: ['tag1'],
        parameters: {},
        returnType: 'string',
        examples: ['ex1']
      }],
      dependencies: [],
      requirements: { cpu: '100m', memory: '128Mi', storage: '1Gi' },
      createdAt: new Date(),
      updatedAt: new Date()
    },
    health: {
      status: 'healthy',
      lastHeartbeat: new Date(),
      responseTime: 100,
      errorCount: 0,
      uptime: 3600,
      resourceUsage: { cpu: 10, memory: 50, disk: 20, network: 5 },
      customMetrics: {}
    },
    endpoint: 'http://localhost:8080',
    protocol: 'http',
    authentication: { type: 'none' },
    loadBalancing: { weight: 1, maxConnections: 100, timeout: 30000 },
    isolation: { namespace: 'default', resourceLimits: {}, securityContext: {} },
    scaling: { minInstances: 1, maxInstances: 10, targetCPUUtilization: 70, targetMemoryUtilization: 80 },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  let baseAgent: AgentRegistration;
  beforeEach(() => {
    service = new AgentDiscoveryService();
    baseAgent = JSON.parse(JSON.stringify(agent));
    // Fix date fields after cloning
    baseAgent.metadata.createdAt = new Date();
    baseAgent.metadata.updatedAt = new Date();
    baseAgent.health.lastHeartbeat = new Date();
    baseAgent.createdAt = new Date();
    baseAgent.updatedAt = new Date();
  });

  it('registers and retrieves an agent', async () => {
    await service.registerAgent(baseAgent);
    const found = await service.getAgentById(baseAgent.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(baseAgent.id);
  });

  it('deregisters an agent', async () => {
    await service.registerAgent(baseAgent);
    await service.deregisterAgent(baseAgent.id);
    const found = await service.getAgentById(baseAgent.id);
    expect(found).toBeNull();
  });

  it('updates agent health', async () => {
    await service.registerAgent(baseAgent);
    const newHealth = { ...baseAgent.health, status: 'degraded' as 'degraded', responseTime: 500 };
    await service.updateAgentHealth(baseAgent.id, newHealth);
    const found = await service.getAgentById(baseAgent.id);
    expect(found!.health.status).toBe('degraded');
    expect(found!.health.responseTime).toBe(500);
  });

  it('searches by capability returns empty if none', async () => {
    await service.registerAgent(baseAgent);
    const result = await service.searchByCapability('nonexistent');
    expect(result).toBeNull();
  });

  it('discovers agents by query', async () => {
    await service.registerAgent(baseAgent);
    const result = await service.discoverAgents({ tags: ['test'], limit: 10 });
    expect(result.agents.length).toBe(1);
    expect(result.total).toBe(1);
  });

  it('gets agent statistics', async () => {
    await service.registerAgent(baseAgent);
    const stats = await service.getAgentStatistics();
    expect(stats.total).toBe(1);
    expect(stats.healthy).toBe(1);
  });
}); 