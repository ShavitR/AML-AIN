import { 
  AgentRegistration, 
  AgentDiscoveryQuery, 
  AgentCapability,
  AgentHealth 
} from './types';
import { RegistrationProtocol } from './registration-protocol';

export interface DiscoveryResult {
  agents: AgentRegistration[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CapabilitySearchResult {
  capability: AgentCapability;
  agents: AgentRegistration[];
  totalAgents: number;
}

export class AgentDiscoveryService {
  private agents: Map<string, AgentRegistration> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private namespaceIndex: Map<string, Set<string>> = new Map();
  private healthCache: Map<string, AgentHealth> = new Map();
  private lastUpdate: Date = new Date();

  /**
   * Register an agent
   */
  async registerAgent(registration: AgentRegistration): Promise<void> {
    // Validate registration
    const validation = RegistrationProtocol.validateRegistrationRequest({
      metadata: registration.metadata,
      endpoint: registration.endpoint,
      protocol: registration.protocol,
      authentication: registration.authentication,
      loadBalancing: registration.loadBalancing,
      isolation: registration.isolation,
      scaling: registration.scaling
    });

    if (!validation.isValid) {
      throw new Error(`Invalid registration: ${validation.errors.join(', ')}`);
    }

    // Check for conflicts
    const conflicts = await this.detectConflicts(registration);
    if (conflicts.length > 0) {
      throw new Error(`Registration conflicts detected: ${conflicts.map(c => c.description).join(', ')}`);
    }

    // Store agent
    this.agents.set(registration.id, registration);
    
    // Update indexes
    this.updateIndexes(registration);
    
    this.lastUpdate = new Date();
  }

  /**
   * Deregister an agent
   */
  async deregisterAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Remove from main storage
    this.agents.delete(agentId);
    
    // Remove from indexes
    this.removeFromIndexes(agent);
    
    // Remove from health cache
    this.healthCache.delete(agentId);
    
    this.lastUpdate = new Date();
  }

  /**
   * Update agent health
   */
  async updateAgentHealth(agentId: string, health: AgentHealth): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Update health in agent registration
    agent.health = health;
    agent.updatedAt = new Date();
    
    // Update health cache
    this.healthCache.set(agentId, health);
    
    this.lastUpdate = new Date();
  }

  /**
   * Discover agents based on query
   */
  async discoverAgents(query: AgentDiscoveryQuery): Promise<DiscoveryResult> {
    let results = Array.from(this.agents.values());

    // Apply filters
    results = this.applyFilters(results, query);

    // Apply sorting
    results = this.applySorting(results, query.sortBy, query.sortOrder);

    // Apply pagination
    const total = results.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const page = Math.floor(offset / limit) + 1;
    
    results = results.slice(offset, offset + limit);

    return {
      agents: results,
      total,
      page,
      limit,
      hasMore: offset + limit < total
    };
  }

  /**
   * Search agents by capability
   */
  async searchByCapability(capabilityId: string): Promise<CapabilitySearchResult | null> {
    const agentIds = this.capabilityIndex.get(capabilityId);
    if (!agentIds || agentIds.size === 0) {
      return null;
    }

    const agents = Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(agent => agent !== undefined) as AgentRegistration[];

    // Find the capability details from the first agent that has it
    let capability: AgentCapability | undefined;
    for (const agent of agents) {
      capability = agent.metadata.capabilities.find(c => c.id === capabilityId);
      if (capability) break;
    }

    if (!capability) {
      return null;
    }

    return {
      capability,
      agents,
      totalAgents: agents.length
    };
  }

  /**
   * Get agent by ID
   */
  async getAgentById(agentId: string): Promise<AgentRegistration | null> {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all agents
   */
  async getAllAgents(): Promise<AgentRegistration[]> {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by namespace
   */
  async getAgentsByNamespace(namespace: string): Promise<AgentRegistration[]> {
    const agentIds = this.namespaceIndex.get(namespace);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(agent => agent !== undefined) as AgentRegistration[];
  }

  /**
   * Get agents by category
   */
  async getAgentsByCategory(category: string): Promise<AgentRegistration[]> {
    const agentIds = this.categoryIndex.get(category);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(agent => agent !== undefined) as AgentRegistration[];
  }

  /**
   * Get agents by tag
   */
  async getAgentsByTag(tag: string): Promise<AgentRegistration[]> {
    const agentIds = this.tagIndex.get(tag);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter(agent => agent !== undefined) as AgentRegistration[];
  }

  /**
   * Get healthy agents
   */
  async getHealthyAgents(): Promise<AgentRegistration[]> {
    return Array.from(this.agents.values())
      .filter(agent => agent.health.status === 'healthy');
  }

  /**
   * Get agent statistics
   */
  async getAgentStatistics(): Promise<{
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
    unknown: number;
    byCategory: Record<string, number>;
    byNamespace: Record<string, number>;
  }> {
    const agents = Array.from(this.agents.values());
    
    const stats = {
      total: agents.length,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0,
      byCategory: {} as Record<string, number>,
      byNamespace: {} as Record<string, number>
    };

    for (const agent of agents) {
      // Count by health status
      stats[agent.health.status]++;
      
      // Count by category
      const category = agent.metadata.capabilities[0]?.category || 'unknown';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      
      // Count by namespace
      const namespace = agent.isolation.namespace;
      stats.byNamespace[namespace] = (stats.byNamespace[namespace] || 0) + 1;
    }

    return stats;
  }

  /**
   * Get last update timestamp
   */
  getLastUpdate(): Date {
    return this.lastUpdate;
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.agents.clear();
    this.capabilityIndex.clear();
    this.tagIndex.clear();
    this.categoryIndex.clear();
    this.namespaceIndex.clear();
    this.healthCache.clear();
    this.lastUpdate = new Date();
  }

  /**
   * Apply filters to agent list
   */
  private applyFilters(agents: AgentRegistration[], query: AgentDiscoveryQuery): AgentRegistration[] {
    return agents.filter(agent => {
      // Filter by capabilities
      if (query.capabilities && query.capabilities.length > 0) {
        const agentCapabilities = agent.metadata.capabilities.map(c => c.id);
        if (!query.capabilities.some(cap => agentCapabilities.includes(cap))) {
          return false;
        }
      }

      // Filter by tags
      if (query.tags && query.tags.length > 0) {
        if (!query.tags.some(tag => agent.metadata.tags.includes(tag))) {
          return false;
        }
      }

      // Filter by category
      if (query.category) {
        const agentCategories = agent.metadata.capabilities.map(c => c.category);
        if (!agentCategories.includes(query.category!)) {
          return false;
        }
      }

      // Filter by version
      if (query.version) {
        if (agent.metadata.version !== query.version) {
          return false;
        }
      }

      // Filter by status
      if (query.status) {
        if (agent.health.status !== query.status) {
          return false;
        }
      }

      // Filter by namespace
      if (query.namespace) {
        if (agent.isolation.namespace !== query.namespace) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sorting to agent list
   */
  private applySorting(agents: AgentRegistration[], sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): AgentRegistration[] {
    if (!sortBy) {
      return agents;
    }

    return agents.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.metadata.name;
          bValue = b.metadata.name;
          break;
        case 'version':
          aValue = a.metadata.version;
          bValue = b.metadata.version;
          break;
        case 'createdAt':
          aValue = a.createdAt;
          bValue = b.createdAt;
          break;
        case 'updatedAt':
          aValue = a.updatedAt;
          bValue = b.updatedAt;
          break;
        case 'responseTime':
          aValue = a.health.responseTime;
          bValue = b.health.responseTime;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  /**
   * Update indexes when registering an agent
   */
  private updateIndexes(agent: AgentRegistration): void {
    // Update capability index
    for (const capability of agent.metadata.capabilities) {
      if (!this.capabilityIndex.has(capability.id)) {
        this.capabilityIndex.set(capability.id, new Set());
      }
      this.capabilityIndex.get(capability.id)!.add(agent.id);
    }

    // Update tag index
    for (const tag of agent.metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(agent.id);
    }

    // Update category index
    for (const capability of agent.metadata.capabilities) {
      if (!this.categoryIndex.has(capability.category)) {
        this.categoryIndex.set(capability.category, new Set());
      }
      this.categoryIndex.get(capability.category)!.add(agent.id);
    }

    // Update namespace index
    const namespace = agent.isolation.namespace;
    if (!this.namespaceIndex.has(namespace)) {
      this.namespaceIndex.set(namespace, new Set());
    }
    this.namespaceIndex.get(namespace)!.add(agent.id);
  }

  /**
   * Remove from indexes when deregistering an agent
   */
  private removeFromIndexes(agent: AgentRegistration): void {
    // Remove from capability index
    for (const capability of agent.metadata.capabilities) {
      const capabilitySet = this.capabilityIndex.get(capability.id);
      if (capabilitySet) {
        capabilitySet.delete(agent.id);
        if (capabilitySet.size === 0) {
          this.capabilityIndex.delete(capability.id);
        }
      }
    }

    // Remove from tag index
    for (const tag of agent.metadata.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(agent.id);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Remove from category index
    for (const capability of agent.metadata.capabilities) {
      const categorySet = this.categoryIndex.get(capability.category);
      if (categorySet) {
        categorySet.delete(agent.id);
        if (categorySet.size === 0) {
          this.categoryIndex.delete(capability.category);
        }
      }
    }

    // Remove from namespace index
    const namespaceSet = this.namespaceIndex.get(agent.isolation.namespace);
    if (namespaceSet) {
      namespaceSet.delete(agent.id);
      if (namespaceSet.size === 0) {
        this.namespaceIndex.delete(agent.isolation.namespace);
      }
    }
  }

  /**
   * Detect conflicts when registering an agent
   */
  private async detectConflicts(registration: AgentRegistration): Promise<any[]> {
    const conflicts: any[] = [];

    // Check for duplicate agent ID
    if (this.agents.has(registration.id)) {
      conflicts.push({
        type: 'duplicate_id',
        description: `Agent ID ${registration.id} already exists`,
        severity: 'high'
      });
    }

    // Check for endpoint conflicts
    const existingAgent = Array.from(this.agents.values())
      .find(agent => agent.endpoint === registration.endpoint);
    if (existingAgent) {
      conflicts.push({
        type: 'endpoint_conflict',
        description: `Endpoint ${registration.endpoint} is already in use by agent ${existingAgent.id}`,
        severity: 'high'
      });
    }

    // Check for capability conflicts (same capability, different versions)
    for (const capability of registration.metadata.capabilities) {
      const existingAgents = Array.from(this.agents.values())
        .filter(agent => agent.metadata.capabilities.some(c => c.id === capability.id && c.version !== capability.version));
      
      if (existingAgents.length > 0) {
        conflicts.push({
          type: 'capability_version_conflict',
          description: `Capability ${capability.id} has version conflicts with existing agents`,
          severity: 'medium',
          affectedAgents: existingAgents.map(a => a.id)
        });
      }
    }

    return conflicts;
  }
} 