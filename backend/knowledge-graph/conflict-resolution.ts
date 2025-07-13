import { KnowledgeNode } from './types';
import { KnowledgeRelationship, KnowledgeValidationResult, ValidationError } from './types';

export interface ConflictInfo {
  type: 'node' | 'relationship';
  id: string;
  conflictType: 'merge' | 'version' | 'schema' | 'access';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  conflictingData: any[];
  resolution: ConflictResolution;
  timestamp: Date;
}

export interface ConflictResolution {
  strategy: 'manual' | 'automatic' | 'merge' | 'keep_latest' | 'keep_original' | 'custom';
  resolvedBy?: string;
  resolvedAt?: Date;
  notes?: string;
  customResolution?: any;
}

export interface MergeResult {
  success: boolean;
  mergedNode?: KnowledgeNode;
  conflicts: ConflictInfo[];
  warnings: string[];
  mergeHistory: MergeHistoryEntry[];
}

export interface MergeHistoryEntry {
  timestamp: Date;
  operation: 'merge' | 'conflict' | 'resolution';
  description: string;
  data: any;
}

export interface VersionHistory {
  nodeId: string;
  versions: VersionEntry[];
  currentVersion: number;
  branchHistory: BranchEntry[];
}

export interface VersionEntry {
  version: number;
  timestamp: Date;
  author: string;
  changes: ChangeRecord[];
  metadata: any;
  checksum: string;
}

export interface BranchEntry {
  branchId: string;
  parentVersion: number;
  createdAt: Date;
  mergedAt?: Date;
  status: 'active' | 'merged' | 'abandoned';
}

export interface ChangeRecord {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'add' | 'modify' | 'delete';
}

export class ConflictResolutionEngine {
  private versionHistories: Map<string, VersionHistory> = new Map();
  private conflictLog: ConflictInfo[] = [];
  private mergeStrategies: Map<
    string,
    (node1: KnowledgeNode, node2: KnowledgeNode) => KnowledgeNode
  > = new Map();

  constructor() {
    this.initializeDefaultStrategies();
  }

  private initializeDefaultStrategies(): void {
    // Default merge strategy for concepts
    this.mergeStrategies.set('concept', (node1: KnowledgeNode, node2: KnowledgeNode) => {
      return {
        ...node1,
        content: this.mergeContent(node1.content, node2.content),
        metadata: this.mergeMetadata(node1.metadata, node2.metadata),
        tags: [...new Set([...node1.tags, ...node2.tags])],
        confidence: Math.max(node1.confidence, node2.confidence),
        version: Math.max(node1.version, node2.version) + 1,
        updatedAt: new Date(),
      };
    });

    // Default merge strategy for facts
    this.mergeStrategies.set('fact', (node1: KnowledgeNode, node2: KnowledgeNode) => {
      return {
        ...node1,
        content: this.mergeFactContent(node1.content, node2.content),
        metadata: this.mergeMetadata(node1.metadata, node2.metadata),
        confidence: (node1.confidence + node2.confidence) / 2,
        version: Math.max(node1.version, node2.version) + 1,
        updatedAt: new Date(),
      };
    });
  }

  async detectConflicts(node1: KnowledgeNode, node2: KnowledgeNode): Promise<ConflictInfo[]> {
    const conflicts: ConflictInfo[] = [];

    // Check for content conflicts
    if (node1.content !== node2.content) {
      conflicts.push({
        type: 'node',
        id: node1.id,
        conflictType: 'merge',
        severity: 'medium',
        description: 'Content conflict detected between versions',
        conflictingData: [node1.content, node2.content],
        resolution: { strategy: 'manual' },
        timestamp: new Date(),
      });
    }

    // Check for metadata conflicts
    const metadataConflicts = this.detectMetadataConflicts(node1.metadata, node2.metadata);
    conflicts.push(
      ...metadataConflicts.map((conflict) => ({
        ...conflict,
        type: 'node' as const,
        id: node1.id,
        timestamp: new Date(),
      })),
    );

    // Check for tag conflicts
    const tagConflicts = this.detectTagConflicts(node1.tags, node2.tags);
    if (tagConflicts.length > 0) {
      conflicts.push({
        type: 'node',
        id: node1.id,
        conflictType: 'merge',
        severity: 'low',
        description: 'Tag conflicts detected',
        conflictingData: [node1.tags, node2.tags],
        resolution: { strategy: 'merge' },
        timestamp: new Date(),
      });
    }

    return conflicts;
  }

  async mergeNodes(
    node1: KnowledgeNode,
    node2: KnowledgeNode,
    strategy?: string,
  ): Promise<MergeResult> {
    const conflicts = await this.detectConflicts(node1, node2);
    const mergeHistory: MergeHistoryEntry[] = [];
    const warnings: string[] = [];

    // Record merge attempt
    mergeHistory.push({
      timestamp: new Date(),
      operation: 'merge',
      description: `Attempting to merge nodes ${node1.id} and ${node2.id}`,
      data: { node1Id: node1.id, node2Id: node2.id, strategy },
    });

    if (conflicts.length > 0) {
      mergeHistory.push({
        timestamp: new Date(),
        operation: 'conflict',
        description: `Detected ${conflicts.length} conflicts during merge`,
        data: conflicts,
      });

      // Log conflicts
      this.conflictLog.push(...conflicts);

      if (strategy === 'automatic') {
        return this.resolveConflictsAutomatically(node1, node2, conflicts, mergeHistory);
      } else {
        return {
          success: false,
          conflicts,
          warnings: ['Manual resolution required due to conflicts'],
          mergeHistory,
        };
      }
    }

    // No conflicts, proceed with merge
    const mergedNode = this.performMerge(node1, node2, strategy);

    // Update version history
    this.updateVersionHistory(mergedNode, node1, node2);

    mergeHistory.push({
      timestamp: new Date(),
      operation: 'merge',
      description: 'Merge completed successfully',
      data: { mergedNodeId: mergedNode.id, version: mergedNode.version },
    });

    return {
      success: true,
      mergedNode,
      conflicts: [],
      warnings,
      mergeHistory,
    };
  }

  private performMerge(
    node1: KnowledgeNode,
    node2: KnowledgeNode,
    strategy?: string,
  ): KnowledgeNode {
    const nodeType = node1.type;
    const mergeStrategy =
      this.mergeStrategies.get(nodeType) || this.mergeStrategies.get('concept')!;

    return mergeStrategy(node1, node2);
  }

  private resolveConflictsAutomatically(
    node1: KnowledgeNode,
    node2: KnowledgeNode,
    conflicts: ConflictInfo[],
    mergeHistory: MergeHistoryEntry[],
  ): MergeResult {
    const warnings: string[] = [];
    let mergedNode = { ...node1 };

    for (const conflict of conflicts) {
      switch (conflict.conflictType) {
        case 'merge':
          if (conflict.severity === 'low') {
            // Auto-resolve low severity conflicts
            mergedNode = this.autoResolveConflict(mergedNode, node2, conflict);
            warnings.push(`Auto-resolved low severity conflict: ${conflict.description}`);
          } else {
            warnings.push(`Manual resolution required for: ${conflict.description}`);
          }
          break;
        default:
          warnings.push(`Unsupported conflict type: ${conflict.conflictType}`);
      }
    }

    // Update version
    mergedNode.version = Math.max(node1.version, node2.version) + 1;
    mergedNode.updatedAt = new Date();

    mergeHistory.push({
      timestamp: new Date(),
      operation: 'merge',
      description: 'Automatic conflict resolution completed',
      data: { resolvedConflicts: conflicts.length, warnings },
    });

    return {
      success: true,
      mergedNode,
      conflicts: [],
      warnings,
      mergeHistory,
    };
  }

  private autoResolveConflict(
    node1: KnowledgeNode,
    node2: KnowledgeNode,
    conflict: ConflictInfo,
  ): KnowledgeNode {
    // Simple auto-resolution: keep the more recent version
    return node1.updatedAt > node2.updatedAt ? node1 : node2;
  }

  private mergeContent(content1: any, content2: any): any {
    if (typeof content1 === 'string' && typeof content2 === 'string') {
      // For string content, combine with separator
      return `${content1}\n\n---\n\n${content2}`;
    }

    if (typeof content1 === 'object' && typeof content2 === 'object') {
      // For object content, merge properties
      return { ...content1, ...content2 };
    }

    // Default: keep the first content
    return content1;
  }

  private mergeFactContent(content1: any, content2: any): any {
    // For facts, we need to be more careful about merging
    if (typeof content1 === 'string' && typeof content2 === 'string') {
      // Check if they're the same fact
      if (content1.toLowerCase() === content2.toLowerCase()) {
        return content1; // Keep the original
      }
      // Different facts, combine them
      return `${content1}. ${content2}`;
    }
    return this.mergeContent(content1, content2);
  }

  private mergeMetadata(metadata1: any, metadata2: any): any {
    return { ...metadata1, ...metadata2 };
  }

  private detectMetadataConflicts(metadata1: any, metadata2: any): ConflictInfo[] {
    const conflicts: ConflictInfo[] = [];

    for (const key in metadata2) {
      if (metadata1[key] !== undefined && metadata1[key] !== metadata2[key]) {
        conflicts.push({
          type: 'node',
          id: '', // Will be set by caller
          conflictType: 'merge',
          severity: 'low',
          description: `Metadata conflict in field: ${key}`,
          conflictingData: [metadata1[key], metadata2[key]],
          resolution: { strategy: 'merge' },
          timestamp: new Date(),
        });
      }
    }

    return conflicts;
  }

  private detectTagConflicts(tags1: string[], tags2: string[]): string[] {
    const conflicts: string[] = [];

    for (const tag of tags2) {
      if (tags1.includes(tag)) {
        conflicts.push(tag);
      }
    }

    return conflicts;
  }

  private updateVersionHistory(
    mergedNode: KnowledgeNode,
    node1: KnowledgeNode,
    node2: KnowledgeNode,
  ): void {
    let history = this.versionHistories.get(mergedNode.id);

    if (!history) {
      history = {
        nodeId: mergedNode.id,
        versions: [],
        currentVersion: 1,
        branchHistory: [],
      };
      this.versionHistories.set(mergedNode.id, history);
    }

    // Add version entry for the merge
    const versionEntry: VersionEntry = {
      version: mergedNode.version,
      timestamp: new Date(),
      author: 'system',
      changes: [
        {
          field: 'content',
          oldValue: node1.content,
          newValue: mergedNode.content,
          changeType: 'modify',
        },
      ],
      metadata: {
        mergeFrom: [node1.version, node2.version],
        operation: 'merge',
      },
      checksum: this.generateChecksum(mergedNode),
    };

    history.versions.push(versionEntry);
    history.currentVersion = mergedNode.version;
  }

  private generateChecksum(node: KnowledgeNode): string {
    // Simple checksum generation
    const content = JSON.stringify(node);
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  getVersionHistory(nodeId: string): VersionHistory | undefined {
    return this.versionHistories.get(nodeId);
  }

  getConflictLog(): ConflictInfo[] {
    return [...this.conflictLog];
  }

  addMergeStrategy(
    nodeType: string,
    strategy: (node1: KnowledgeNode, node2: KnowledgeNode) => KnowledgeNode,
  ): void {
    this.mergeStrategies.set(nodeType, strategy);
  }

  resolveConflict(conflictId: string, resolution: ConflictResolution): void {
    const conflict = this.conflictLog.find((c) => c.id === conflictId);
    if (conflict) {
      conflict.resolution = resolution;
      conflict.resolution.resolvedAt = new Date();
    }
  }
}
