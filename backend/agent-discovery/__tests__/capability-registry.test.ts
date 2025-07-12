import { CapabilityRegistry } from '../capability-registry';
import { AgentCapability } from '../types';

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;
  const agentId = 'agent-1';
  const capability: AgentCapability = {
    id: 'cap-1',
    name: 'Test Capability',
    description: 'A test capability',
    version: '1.0.0',
    category: 'test',
    tags: ['tag1', 'tag2'],
    parameters: {},
    returnType: 'string',
    examples: ['ex1']
  };

  beforeEach(() => {
    registry = new CapabilityRegistry();
  });

  it('registers and retrieves a capability', async () => {
    await registry.registerCapability(agentId, capability);
    const meta = await registry.getCapability(capability.id);
    expect(meta).not.toBeNull();
    expect(meta!.id).toBe(capability.id);
  });

  it('registers multiple versions and updates latestVersion', async () => {
    await registry.registerCapability(agentId, capability);
    const v2 = { ...capability, version: '2.0.0' };
    await registry.registerCapability(agentId, v2);
    const meta = await registry.getCapability(capability.id);
    expect(meta!.latestVersion).toBe('2.0.0');
    expect(meta!.versions.length).toBe(2);
  });

  it('unregisters a capability and removes it if no agents left', async () => {
    await registry.registerCapability(agentId, capability);
    await registry.unregisterCapability(agentId, capability.id);
    const meta = await registry.getCapability(capability.id);
    expect(meta).toBeNull();
  });

  it('gets a specific capability version', async () => {
    await registry.registerCapability(agentId, capability);
    const v = await registry.getCapabilityVersion(capability.id, capability.version);
    expect(v).not.toBeNull();
    expect(v!.version).toBe(capability.version);
  });

  it('gets the latest capability version', async () => {
    await registry.registerCapability(agentId, capability);
    const v2 = { ...capability, version: '2.0.0' };
    await registry.registerCapability(agentId, v2);
    const latest = await registry.getLatestCapabilityVersion(capability.id);
    expect(latest!.version).toBe('2.0.0');
  });

  it('searches capabilities by name', async () => {
    await registry.registerCapability(agentId, capability);
    const result = await registry.searchCapabilities({ name: 'Test' });
    expect(result.capabilities.length).toBeGreaterThan(0);
  });

  it('gets capabilities by category', async () => {
    await registry.registerCapability(agentId, capability);
    const result = await registry.getCapabilitiesByCategory('test');
    expect(result.length).toBe(1);
  });

  it('gets capabilities by tag', async () => {
    await registry.registerCapability(agentId, capability);
    const result = await registry.getCapabilitiesByTag('tag1');
    expect(result.length).toBe(1);
  });

  it('gets all capabilities', async () => {
    await registry.registerCapability(agentId, capability);
    const all = await registry.getAllCapabilities();
    expect(all.length).toBe(1);
  });

  it('gets capability statistics', async () => {
    await registry.registerCapability(agentId, capability);
    const stats = await registry.getCapabilityStatistics();
    expect(stats.totalCapabilities).toBe(1);
    expect(stats.totalVersions).toBe(1);
  });

  it('deprecates a capability version', async () => {
    await registry.registerCapability(agentId, capability);
    await registry.deprecateCapabilityVersion(capability.id, capability.version, '2.0.0');
    const v = await registry.getCapabilityVersion(capability.id, capability.version);
    expect(v!.deprecated).toBe(true);
    expect(v!.replacementVersion).toBe('2.0.0');
  });

  it('gets agents for a capability', async () => {
    await registry.registerCapability(agentId, capability);
    const agents = await registry.getAgentsForCapability(capability.id, capability.version);
    expect(agents).toContain(agentId);
  });

  it('gets all versions for a capability', async () => {
    await registry.registerCapability(agentId, capability);
    const v2 = { ...capability, version: '2.0.0' };
    await registry.registerCapability(agentId, v2);
    const versions = await registry.getCapabilityVersions(capability.id);
    expect(versions.length).toBe(2);
  });

  it('clears all capabilities', async () => {
    await registry.registerCapability(agentId, capability);
    await registry.clear();
    const all = await registry.getAllCapabilities();
    expect(all.length).toBe(0);
  });
}); 