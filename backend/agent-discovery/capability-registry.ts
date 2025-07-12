import { AgentCapability, AgentRegistration } from './types';

export interface CapabilityVersion {
  version: string;
  capability: AgentCapability;
  agents: string[];
  deprecated: boolean;
  deprecatedDate?: Date;
  replacementVersion?: string;
}

export interface CapabilityMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  versions: CapabilityVersion[];
  latestVersion: string;
  totalAgents: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CapabilitySearchQuery {
  name?: string;
  category?: string;
  tags?: string[];
  version?: string;
  deprecated?: boolean;
  limit?: number;
  offset?: number;
}

export interface CapabilitySearchResult {
  capabilities: CapabilityMetadata[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class CapabilityRegistry {
  private capabilities: Map<string, CapabilityMetadata> = new Map();
  private nameIndex: Map<string, string> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private versionIndex: Map<string, Map<string, string>> = new Map();

  /**
   * Register a capability from an agent
   */
  async registerCapability(agentId: string, capability: AgentCapability): Promise<void> {
    const capabilityId = capability.id;
    
    if (!this.capabilities.has(capabilityId)) {
      // Create new capability metadata
      const metadata: CapabilityMetadata = {
        id: capabilityId,
        name: capability.name,
        description: capability.description,
        category: capability.category,
        tags: capability.tags,
        versions: [],
        latestVersion: capability.version,
        totalAgents: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.capabilities.set(capabilityId, metadata);
      this.updateIndexes(metadata);
    }

    const metadata = this.capabilities.get(capabilityId)!;
    
    // Add or update version
    const existingVersionIndex = metadata.versions.findIndex(v => v.version === capability.version);
    if (existingVersionIndex >= 0) {
      // Update existing version
      const existingVersion = metadata.versions[existingVersionIndex];
      if (existingVersion) {
        existingVersion.capability = capability;
        if (!existingVersion.agents.includes(agentId)) {
          existingVersion.agents.push(agentId);
        }
      }
    } else {
      // Add new version
      metadata.versions.push({
        version: capability.version,
        capability,
        agents: [agentId],
        deprecated: false
      });
    }

    // Update latest version if this is newer
    if (this.isVersionNewer(capability.version, metadata.latestVersion)) {
      metadata.latestVersion = capability.version;
    }

    // Update metadata
    metadata.updatedAt = new Date();
    metadata.totalAgents = this.calculateTotalAgents(metadata.versions);
    
    // Update version index
    this.updateVersionIndex(capabilityId, capability.version, agentId);
  }

  /**
   * Unregister a capability from an agent
   */
  async unregisterCapability(agentId: string, capabilityId: string): Promise<void> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      return;
    }

    // Remove agent from all versions
    for (const version of metadata.versions) {
      const agentIndex = version.agents.indexOf(agentId);
      if (agentIndex >= 0) {
        version.agents.splice(agentIndex, 1);
      }
    }

    // Remove versions with no agents
    metadata.versions = metadata.versions.filter(v => v.agents.length > 0);

    // Update metadata
    metadata.updatedAt = new Date();
    metadata.totalAgents = this.calculateTotalAgents(metadata.versions);

    // Update latest version
    if (metadata.versions.length > 0) {
      metadata.latestVersion = metadata.versions
        .map(v => v.version)
        .sort((a, b) => this.compareVersions(a, b))
        .pop()!;
    }

    // Remove from version index
    this.removeFromVersionIndex(capabilityId, agentId);

    // Remove capability if no versions left
    if (metadata.versions.length === 0) {
      this.capabilities.delete(capabilityId);
      this.removeFromIndexes(metadata);
    }
  }

  /**
   * Get capability metadata by ID
   */
  async getCapability(capabilityId: string): Promise<CapabilityMetadata | null> {
    return this.capabilities.get(capabilityId) || null;
  }

  /**
   * Get capability version
   */
  async getCapabilityVersion(capabilityId: string, version: string): Promise<CapabilityVersion | null> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      return null;
    }

    return metadata.versions.find(v => v.version === version) || null;
  }

  /**
   * Get latest version of a capability
   */
  async getLatestCapabilityVersion(capabilityId: string): Promise<CapabilityVersion | null> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      return null;
    }

    return metadata.versions.find(v => v.version === metadata.latestVersion) || null;
  }

  /**
   * Search capabilities
   */
  async searchCapabilities(query: CapabilitySearchQuery): Promise<CapabilitySearchResult> {
    let results = Array.from(this.capabilities.values());

    // Apply filters
    if (query.name) {
      results = results.filter(c => 
        c.name.toLowerCase().includes(query.name!.toLowerCase()) ||
        c.id.toLowerCase().includes(query.name!.toLowerCase())
      );
    }

    if (query.category) {
      results = results.filter(c => c.category === query.category);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(c => 
        query.tags!.some(tag => c.tags.includes(tag))
      );
    }

    if (query.version) {
      results = results.filter(c => 
        c.versions.some(v => v.version === query.version)
      );
    }

    if (query.deprecated !== undefined) {
      results = results.filter(c => 
        c.versions.some(v => v.deprecated === query.deprecated)
      );
    }

    // Apply pagination
    const total = results.length;
    const offset = query.offset || 0;
    const limit = query.limit || 50;
    const page = Math.floor(offset / limit) + 1;
    
    results = results.slice(offset, offset + limit);

    return {
      capabilities: results,
      total,
      page,
      limit,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get capabilities by category
   */
  async getCapabilitiesByCategory(category: string): Promise<CapabilityMetadata[]> {
    const capabilityIds = this.categoryIndex.get(category);
    if (!capabilityIds) {
      return [];
    }

    return Array.from(capabilityIds)
      .map(id => this.capabilities.get(id))
      .filter(capability => capability !== undefined) as CapabilityMetadata[];
  }

  /**
   * Get capabilities by tag
   */
  async getCapabilitiesByTag(tag: string): Promise<CapabilityMetadata[]> {
    const capabilityIds = this.tagIndex.get(tag);
    if (!capabilityIds) {
      return [];
    }

    return Array.from(capabilityIds)
      .map(id => this.capabilities.get(id))
      .filter(capability => capability !== undefined) as CapabilityMetadata[];
  }

  /**
   * Get all capabilities
   */
  async getAllCapabilities(): Promise<CapabilityMetadata[]> {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get capability statistics
   */
  async getCapabilityStatistics(): Promise<{
    totalCapabilities: number;
    totalVersions: number;
    byCategory: Record<string, number>;
    byTag: Record<string, number>;
    deprecatedCount: number;
  }> {
    const capabilities = Array.from(this.capabilities.values());
    
    const stats = {
      totalCapabilities: capabilities.length,
      totalVersions: capabilities.reduce((sum, c) => sum + c.versions.length, 0),
      byCategory: {} as Record<string, number>,
      byTag: {} as Record<string, number>,
      deprecatedCount: 0
    };

    for (const capability of capabilities) {
      // Count by category
      stats.byCategory[capability.category] = (stats.byCategory[capability.category] || 0) + 1;
      
      // Count by tags
      for (const tag of capability.tags) {
        stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
      }
      
      // Count deprecated versions
      stats.deprecatedCount += capability.versions.filter(v => v.deprecated).length;
    }

    return stats;
  }

  /**
   * Mark a capability version as deprecated
   */
  async deprecateCapabilityVersion(capabilityId: string, version: string, replacementVersion?: string): Promise<void> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      throw new Error(`Capability ${capabilityId} not found`);
    }

    const versionData = metadata.versions.find(v => v.version === version);
    if (!versionData) {
      throw new Error(`Version ${version} of capability ${capabilityId} not found`);
    }

    versionData.deprecated = true;
    versionData.deprecatedDate = new Date();
    if (replacementVersion) {
      versionData.replacementVersion = replacementVersion;
    }

    metadata.updatedAt = new Date();
  }

  /**
   * Get agents that provide a specific capability
   */
  async getAgentsForCapability(capabilityId: string, version?: string): Promise<string[]> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      return [];
    }

    if (version) {
      const versionData = metadata.versions.find(v => v.version === version);
      return versionData ? versionData.agents : [];
    }

    // Return agents for all versions
    const allAgents = new Set<string>();
    for (const versionData of metadata.versions) {
      for (const agentId of versionData.agents) {
        allAgents.add(agentId);
      }
    }

    return Array.from(allAgents);
  }

  /**
   * Get all versions of a capability
   */
  async getCapabilityVersions(capabilityId: string): Promise<CapabilityVersion[]> {
    const metadata = this.capabilities.get(capabilityId);
    if (!metadata) {
      return [];
    }

    return [...metadata.versions];
  }

  /**
   * Clear all data (for testing)
   */
  async clear(): Promise<void> {
    this.capabilities.clear();
    this.nameIndex.clear();
    this.categoryIndex.clear();
    this.tagIndex.clear();
    this.versionIndex.clear();
  }

  /**
   * Update indexes when registering a capability
   */
  private updateIndexes(metadata: CapabilityMetadata): void {
    // Update name index
    this.nameIndex.set(metadata.name.toLowerCase(), metadata.id);

    // Update category index
    if (!this.categoryIndex.has(metadata.category)) {
      this.categoryIndex.set(metadata.category, new Set());
    }
    this.categoryIndex.get(metadata.category)!.add(metadata.id);

    // Update tag index
    for (const tag of metadata.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(metadata.id);
    }
  }

  /**
   * Remove from indexes when unregistering a capability
   */
  private removeFromIndexes(metadata: CapabilityMetadata): void {
    // Remove from name index
    this.nameIndex.delete(metadata.name.toLowerCase());

    // Remove from category index
    const categorySet = this.categoryIndex.get(metadata.category);
    if (categorySet) {
      categorySet.delete(metadata.id);
      if (categorySet.size === 0) {
        this.categoryIndex.delete(metadata.category);
      }
    }

    // Remove from tag index
    for (const tag of metadata.tags) {
      const tagSet = this.tagIndex.get(tag);
      if (tagSet) {
        tagSet.delete(metadata.id);
        if (tagSet.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }
  }

  /**
   * Update version index
   */
  private updateVersionIndex(capabilityId: string, version: string, agentId: string): void {
    if (!this.versionIndex.has(capabilityId)) {
      this.versionIndex.set(capabilityId, new Map());
    }
    this.versionIndex.get(capabilityId)!.set(version, agentId);
  }

  /**
   * Remove from version index
   */
  private removeFromVersionIndex(capabilityId: string, agentId: string): void {
    const versionMap = this.versionIndex.get(capabilityId);
    if (versionMap) {
      // Remove agent from all versions
      for (const [version, registeredAgentId] of versionMap.entries()) {
        if (registeredAgentId === agentId) {
          versionMap.delete(version);
        }
      }
      
      // Remove capability if no versions left
      if (versionMap.size === 0) {
        this.versionIndex.delete(capabilityId);
      }
    }
  }

  /**
   * Calculate total agents across all versions
   */
  private calculateTotalAgents(versions: CapabilityVersion[]): number {
    const uniqueAgents = new Set<string>();
    for (const version of versions) {
      for (const agentId of version.agents) {
        uniqueAgents.add(agentId);
      }
    }
    return uniqueAgents.size;
  }

  /**
   * Compare two version strings
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    const maxLength = Math.max(aParts.length, bParts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  /**
   * Check if version a is newer than version b
   */
  private isVersionNewer(a: string, b: string): boolean {
    return this.compareVersions(a, b) > 0;
  }
} 