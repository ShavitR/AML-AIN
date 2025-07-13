import { KnowledgeGraph } from './types';
import { KnowledgeNode, KnowledgeRelationship } from './types';

export interface SharingConfig {
  protocol: 'federation' | 'sync' | 'replication' | 'gossip';
  nodes: string[];
  syncInterval: number;
  conflictResolution: 'last-write-wins' | 'merge' | 'manual';
  encryption: boolean;
  compression: boolean;
  authentication: boolean;
  maxRetries: number;
  timeout: number;
}

export interface FederationNode {
  id: string;
  url: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'syncing';
  lastSync: Date;
  version: string;
  metadata: any;
}

export interface SyncMessage {
  type: 'sync_request' | 'sync_response' | 'update' | 'conflict' | 'heartbeat';
  source: string;
  target: string;
  timestamp: Date;
  data: any;
  checksum: string;
  version: number;
}

export interface SyncResult {
  success: boolean;
  nodesSynced: number;
  conflicts: number;
  time: number;
  errors: string[];
  warnings: string[];
}

export interface ReplicationConfig {
  strategy: 'full' | 'incremental' | 'selective';
  filter: string[];
  schedule: 'continuous' | 'periodic' | 'manual';
  interval: number;
  batchSize: number;
}

export class KnowledgeSharingEngine {
  private config: SharingConfig;
  private federationNodes: Map<string, FederationNode> = new Map();
  private syncHistory: SyncMessage[] = [];
  private replicationConfig: ReplicationConfig;
  private lastSync: Map<string, Date> = new Map();

  constructor(config: Partial<SharingConfig> = {}) {
    this.config = {
      protocol: 'federation',
      nodes: [],
      syncInterval: 300000, // 5 minutes
      conflictResolution: 'last-write-wins',
      encryption: true,
      compression: true,
      authentication: true,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };

    this.replicationConfig = {
      strategy: 'incremental',
      filter: [],
      schedule: 'periodic',
      interval: 600000, // 10 minutes
      batchSize: 100,
    };
  }

  async federateWithNode(nodeUrl: string, capabilities: string[] = []): Promise<boolean> {
    try {
      // Test connection to the federation node
      const response = await this.testConnection(nodeUrl);

      if (response.success) {
        const federationNode: FederationNode = {
          id: response.nodeId,
          url: nodeUrl,
          capabilities,
          status: 'online',
          lastSync: new Date(),
          version: response.version,
          metadata: response.metadata,
        };

        this.federationNodes.set(federationNode.id, federationNode);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`Failed to federate with node ${nodeUrl}:`, error);
      return false;
    }
  }

  async syncWithFederation(graph: KnowledgeGraph): Promise<SyncResult> {
    const startTime = Date.now();
    const results: SyncResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const [nodeId, federationNode] of this.federationNodes) {
      if (federationNode.status === 'online') {
        try {
          const result = await this.syncWithNode(graph, federationNode);
          results.push(result);

          if (!result.success) {
            errors.push(`Sync failed with node ${nodeId}: ${result.errors.join(', ')}`);
          }

          if (result.conflicts > 0) {
            warnings.push(`${result.conflicts} conflicts resolved with node ${nodeId}`);
          }
        } catch (error) {
          errors.push(
            `Sync error with node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          federationNode.status = 'offline';
        }
      }
    }

    const totalNodesSynced = results.reduce((sum, r) => sum + r.nodesSynced, 0);
    const totalConflicts = results.reduce((sum, r) => sum + r.conflicts, 0);
    const totalTime = Date.now() - startTime;

    return {
      success: errors.length === 0,
      nodesSynced: totalNodesSynced,
      conflicts: totalConflicts,
      time: totalTime,
      errors,
      warnings,
    };
  }

  private async syncWithNode(
    graph: KnowledgeGraph,
    federationNode: FederationNode,
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: any[] = [];
    const errors: string[] = [];

    try {
      // Send sync request
      const syncRequest: SyncMessage = {
        type: 'sync_request',
        source: 'local',
        target: federationNode.id,
        timestamp: new Date(),
        data: {
          graphVersion: this.getGraphVersion(graph),
          lastSync: this.lastSync.get(federationNode.id),
          changes: this.getChangesSinceLastSync(graph, federationNode.id),
        },
        checksum: this.generateChecksum(graph),
        version: 1,
      };

      const response = await this.sendMessage(federationNode.url, syncRequest);

      if (response.type === 'sync_response') {
        // Process incoming changes
        const incomingChanges = response.data.changes;
        const conflicts = await this.resolveConflicts(graph, incomingChanges);

        // Apply resolved changes
        const appliedChanges = await this.applyChanges(graph, incomingChanges);

        // Update sync timestamp
        this.lastSync.set(federationNode.id, new Date());
        federationNode.lastSync = new Date();

        return {
          success: true,
          nodesSynced: appliedChanges.length,
          conflicts: conflicts.length,
          time: Date.now() - startTime,
          errors: [],
          warnings: conflicts.length > 0 ? [`${conflicts.length} conflicts resolved`] : [],
        };
      } else if (response.type === 'conflict') {
        // Handle conflicts
        const resolvedConflicts = await this.resolveConflicts(graph, response.data.conflicts);

        return {
          success: true,
          nodesSynced: 0,
          conflicts: resolvedConflicts.length,
          time: Date.now() - startTime,
          errors: [],
          warnings: [`${resolvedConflicts.length} conflicts resolved`],
        };
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Unknown sync error');
    }

    return {
      success: false,
      nodesSynced: 0,
      conflicts: conflicts.length,
      time: Date.now() - startTime,
      errors,
      warnings: [],
    };
  }

  async replicateGraph(graph: KnowledgeGraph, targetNode: string): Promise<boolean> {
    try {
      const replicationData = this.prepareReplicationData(graph);

      if (this.config.compression) {
        const compressedData = await this.compressData(replicationData);
        return await this.sendReplicationData(targetNode, compressedData);
      } else {
        return await this.sendReplicationData(targetNode, replicationData);
      }
    } catch (error) {
      console.error('Replication failed:', error);
      return false;
    }
  }

  async startContinuousSync(graph: KnowledgeGraph): Promise<void> {
    setInterval(async () => {
      await this.syncWithFederation(graph);
    }, this.config.syncInterval);
  }

  async broadcastUpdate(graph: KnowledgeGraph, update: any): Promise<void> {
    const updateMessage: SyncMessage = {
      type: 'update',
      source: 'local',
      target: 'broadcast',
      timestamp: new Date(),
      data: update,
      checksum: this.generateChecksum(update),
      version: this.getGraphVersion(graph),
    };

    for (const [nodeId, federationNode] of this.federationNodes) {
      if (federationNode.status === 'online') {
        try {
          await this.sendMessage(federationNode.url, updateMessage);
        } catch (error) {
          console.error(`Failed to broadcast update to ${nodeId}:`, error);
        }
      }
    }
  }

  private async testConnection(nodeUrl: string): Promise<any> {
    // Simulate connection test
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          nodeId: `node_${Date.now()}`,
          version: '1.0.0',
          metadata: {
            protocol: 'federation',
            capabilities: ['read', 'write', 'sync'],
          },
        });
      }, 100);
    });
  }

  private async sendMessage(url: string, message: SyncMessage): Promise<SyncMessage> {
    // Simulate network communication
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (Math.random() > 0.1) {
          // 90% success rate
          resolve({
            type: 'sync_response',
            source: message.target,
            target: message.source,
            timestamp: new Date(),
            data: {
              changes: [],
              conflicts: [],
            },
            checksum: this.generateChecksum({}),
            version: 1,
          });
        } else {
          reject(new Error('Network error'));
        }
      }, 200);
    });
  }

  private async sendReplicationData(targetNode: string, data: any): Promise<boolean> {
    // Simulate replication
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.05); // 95% success rate
      }, 500);
    });
  }

  private getGraphVersion(graph: KnowledgeGraph): number {
    // Calculate graph version based on nodes and relationships
    return graph.nodes.size + graph.relationships.size;
  }

  private getChangesSinceLastSync(graph: KnowledgeGraph, nodeId: string): any[] {
    const lastSync = this.lastSync.get(nodeId);
    if (!lastSync) {
      // First sync - return all data
      return Array.from(graph.nodes.values()).map((node) => ({
        type: 'node',
        action: 'create',
        data: node,
        timestamp: node.updatedAt,
      }));
    }

    // Return only changes since last sync
    const changes: any[] = [];

    for (const node of graph.nodes.values()) {
      if (node.updatedAt > lastSync) {
        changes.push({
          type: 'node',
          action: 'update',
          data: node,
          timestamp: node.updatedAt,
        });
      }
    }

    for (const rel of graph.relationships.values()) {
      if (rel.updatedAt > lastSync) {
        changes.push({
          type: 'relationship',
          action: 'update',
          data: rel,
          timestamp: rel.updatedAt,
        });
      }
    }

    return changes;
  }

  private async resolveConflicts(graph: KnowledgeGraph, conflicts: any[]): Promise<any[]> {
    const resolved: any[] = [];

    for (const conflict of conflicts) {
      switch (this.config.conflictResolution) {
        case 'last-write-wins':
          resolved.push(this.resolveLastWriteWins(conflict));
          break;
        case 'merge':
          resolved.push(await this.resolveMerge(conflict));
          break;
        case 'manual':
          // Leave for manual resolution
          resolved.push(conflict);
          break;
      }
    }

    return resolved;
  }

  private resolveLastWriteWins(conflict: any): any {
    const local = conflict.local;
    const remote = conflict.remote;

    return local.timestamp > remote.timestamp ? local : remote;
  }

  private async resolveMerge(conflict: any): Promise<any> {
    // Simple merge strategy - combine data
    const local = conflict.local;
    const remote = conflict.remote;

    if (local.type === 'node' && remote.type === 'node') {
      return {
        ...local,
        content: `${local.content}\n\n---\n\n${remote.content}`,
        tags: [...new Set([...local.tags, ...remote.tags])],
        confidence: Math.max(local.confidence, remote.confidence),
        updatedAt: new Date(),
      };
    }

    return local; // Default to local
  }

  private async applyChanges(graph: KnowledgeGraph, changes: any[]): Promise<any[]> {
    const applied: any[] = [];

    for (const change of changes) {
      try {
        if (change.type === 'node') {
          if (change.action === 'create' || change.action === 'update') {
            graph.nodes.set(change.data.id, change.data);
            applied.push(change);
          } else if (change.action === 'delete') {
            graph.nodes.delete(change.data.id);
            applied.push(change);
          }
        } else if (change.type === 'relationship') {
          if (change.action === 'create' || change.action === 'update') {
            graph.relationships.set(change.data.id, change.data);
            applied.push(change);
          } else if (change.action === 'delete') {
            graph.relationships.delete(change.data.id);
            applied.push(change);
          }
        }
      } catch (error) {
        console.error('Failed to apply change:', error);
      }
    }

    return applied;
  }

  private prepareReplicationData(graph: KnowledgeGraph): any {
    return {
      nodes: Array.from(graph.nodes.values()),
      relationships: Array.from(graph.relationships.values()),
      statistics: graph.statistics,
      metadata: {
        version: this.getGraphVersion(graph),
        timestamp: new Date(),
        checksum: this.generateChecksum(graph),
      },
    };
  }

  private async compressData(data: any): Promise<Buffer> {
    const { gzip } = require('zlib');
    const { promisify } = require('util');
    const gzipAsync = promisify(gzip);

    const jsonData = JSON.stringify(data);
    return await gzipAsync(jsonData);
  }

  private generateChecksum(data: any): string {
    const content = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  getFederationNodes(): FederationNode[] {
    return Array.from(this.federationNodes.values());
  }

  getFederationNode(nodeId: string): FederationNode | undefined {
    return this.federationNodes.get(nodeId);
  }

  removeFederationNode(nodeId: string): boolean {
    return this.federationNodes.delete(nodeId);
  }

  updateConfig(newConfig: Partial<SharingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SharingConfig {
    return { ...this.config };
  }

  getSyncHistory(): SyncMessage[] {
    return [...this.syncHistory];
  }

  clearSyncHistory(): void {
    this.syncHistory = [];
  }
}
