import type {
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeGraph,
  GraphStatistics,
  KnowledgeNodeType,
  KnowledgeQuery,
  KnowledgeSearchResult,
  QueryFilter,
  SortOption,
  KnowledgeGraphConfig
} from './types';
import {
  RelationshipType,
  FilterOperator
} from './types';

export class KnowledgeGraphDatabase {
  private nodes: Map<string, KnowledgeNode>;
  private relationships: Map<string, KnowledgeRelationship>;
  private indexes: Map<string, Map<string, Set<string>>>;
  private statistics: GraphStatistics;
  private config: KnowledgeGraphConfig;

  constructor(config: KnowledgeGraphConfig) {
    this.nodes = new Map();
    this.relationships = new Map();
    this.indexes = new Map();
    this.config = config;
    this.statistics = this.initializeStatistics();
    this.initializeIndexes();
  }

  private initializeStatistics(): GraphStatistics {
    return {
      totalNodes: 0,
      totalRelationships: 0,
      nodeTypes: new Map(),
      relationshipTypes: new Map(),
      averageDegree: 0,
      density: 0,
      connectedComponents: 0,
    };
  }

  private initializeIndexes(): void {
    if (!this.config.indexing.enabled) {return;}

    // Initialize indexes for configured fields
    this.config.indexing.indexFields.forEach((field) => {
      this.indexes.set(field, new Map());
    });

    // Initialize indexes for node types
    this.config.indexing.indexTypes.forEach((type) => {
      this.indexes.set(`type:${type}`, new Map());
    });
  }

  // Node Operations
  async createNode(
    node: Omit<KnowledgeNode, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<KnowledgeNode> {
    const id = this.generateId();
    const now = new Date();

    const newNode: KnowledgeNode = {
      ...node,
      id,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    this.nodes.set(id, newNode);
    this.updateIndexes(newNode, 'create');
    this.updateStatistics();

    return newNode;
  }

  async getNode(id: string): Promise<KnowledgeNode | null> {
    return this.nodes.get(id) || null;
  }

  async updateNode(id: string, updates: Partial<KnowledgeNode>): Promise<KnowledgeNode | null> {
    const existingNode = this.nodes.get(id);
    if (!existingNode) {return null;}

    const updatedNode: KnowledgeNode = {
      ...existingNode,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
      version: existingNode.version + 1,
    };

    this.nodes.set(id, updatedNode);
    this.updateIndexes(updatedNode, 'update');
    this.updateStatistics();

    return updatedNode;
  }

  async deleteNode(id: string): Promise<boolean> {
    const node = this.nodes.get(id);
    if (!node) {return false;}

    // Remove all relationships involving this node
    const relationshipsToDelete = Array.from(this.relationships.values()).filter(
      (rel) => rel.sourceId === id || rel.targetId === id
    );

    relationshipsToDelete.forEach((rel) => {
      this.relationships.delete(rel.id);
    });

    this.nodes.delete(id);
    this.updateIndexes(node, 'delete');
    this.updateStatistics();

    return true;
  }

  async listNodes(query: KnowledgeQuery): Promise<KnowledgeSearchResult> {
    const startTime = Date.now();
    let filteredNodes = Array.from(this.nodes.values());

    // Apply filters
    filteredNodes = this.applyFilters(filteredNodes, query.filters);

    // Apply sorting
    filteredNodes = this.applySorting(filteredNodes, query.sort);

    // Apply pagination
    const total = filteredNodes.length;
    const paginatedNodes = filteredNodes.slice(query.offset, query.offset + query.limit);

    // Get relationships if requested
    let relationships: KnowledgeRelationship[] = [];
    if (query.includeRelationships) {
      const nodeIds = paginatedNodes.map((node) => node.id);
      relationships = Array.from(this.relationships.values()).filter(
        (rel) => nodeIds.includes(rel.sourceId) || nodeIds.includes(rel.targetId),
      );
    }

    const executionTime = Date.now() - startTime;

    return {
      nodes: paginatedNodes,
      relationships,
      total,
      query,
      executionTime,
    };
  }

  // Relationship Operations
  async createRelationship(
    relationship: Omit<KnowledgeRelationship, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<KnowledgeRelationship> {
    const id = this.generateId();
    const now = new Date();

    const newRelationship: KnowledgeRelationship = {
      ...relationship,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.relationships.set(id, newRelationship);
    this.updateStatistics();

    return newRelationship;
  }

  async getRelationship(id: string): Promise<KnowledgeRelationship | null> {
    return this.relationships.get(id) || null;
  }

  async updateRelationship(
    id: string,
    updates: Partial<KnowledgeRelationship>,
  ): Promise<KnowledgeRelationship | null> {
    const existingRelationship = this.relationships.get(id);
    if (!existingRelationship) {return null;}

    const updatedRelationship: KnowledgeRelationship = {
      ...existingRelationship,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date(),
    };

    this.relationships.set(id, updatedRelationship);
    this.updateStatistics();

    return updatedRelationship;
  }

  async deleteRelationship(id: string): Promise<boolean> {
    const relationship = this.relationships.get(id);
    if (!relationship) {return false;}

    this.relationships.delete(id);
    this.updateStatistics();

    return true;
  }

  async getNodeRelationships(
    nodeId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both',
  ): Promise<KnowledgeRelationship[]> {
    return Array.from(this.relationships.values()).filter((rel) => {
      switch (direction) {
        case 'incoming':
          return rel.targetId === nodeId;
        case 'outgoing':
          return rel.sourceId === nodeId;
        case 'both':
          return rel.sourceId === nodeId || rel.targetId === nodeId;
      }
    });
  }

  // Search Operations
  async search(
    query: string,
    options: Partial<KnowledgeQuery> = {},
  ): Promise<KnowledgeSearchResult> {
    const defaultQuery: KnowledgeQuery = {
      filters: [],
      sort: [{ field: 'updatedAt', direction: 'desc' }],
      limit: 50,
      offset: 0,
      includeRelationships: false,
      includeMetadata: true,
    };

    const searchQuery = { ...defaultQuery, ...options };

    // Add text search filter
    searchQuery.filters.push({
      field: 'content',
      operator: FilterOperator.CONTAINS,
      value: query,
    });

    return this.listNodes(searchQuery);
  }

  async searchByType(
    type: KnowledgeNodeType,
    query: Partial<KnowledgeQuery> = {},
  ): Promise<KnowledgeSearchResult> {
    const searchQuery: KnowledgeQuery = {
      filters: [
        {
          field: 'type',
          operator: FilterOperator.EQUALS,
          value: type,
        },
      ],
      sort: [{ field: 'updatedAt', direction: 'desc' }],
      limit: 50,
      offset: 0,
      includeRelationships: false,
      includeMetadata: true,
      ...query,
    };

    return this.listNodes(searchQuery);
  }

  async searchByTag(
    tag: string,
    query: Partial<KnowledgeQuery> = {},
  ): Promise<KnowledgeSearchResult> {
    const searchQuery: KnowledgeQuery = {
      filters: [
        {
          field: 'tags',
          operator: FilterOperator.CONTAINS,
          value: tag,
        },
      ],
      sort: [{ field: 'updatedAt', direction: 'desc' }],
      limit: 50,
      offset: 0,
      includeRelationships: false,
      includeMetadata: true,
      ...query,
    };

    return this.listNodes(searchQuery);
  }

  // Graph Operations
  async getGraphStatistics(): Promise<GraphStatistics> {
    return this.statistics;
  }

  async getConnectedNodes(
    nodeId: string,
    maxDepth: number = 1,
  ): Promise<Map<string, KnowledgeNode>> {
    const connectedNodes = new Map<string, KnowledgeNode>();
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId: currentId, depth } = queue.shift()!;

      if (visited.has(currentId) || depth > maxDepth) {continue;}
      visited.add(currentId);

      const node = this.nodes.get(currentId);
      if (node) {
        connectedNodes.set(currentId, node);
      }

      if (depth < maxDepth) {
        const relationships = await this.getNodeRelationships(currentId);
        for (const rel of relationships) {
          const nextId = rel.sourceId === currentId ? rel.targetId : rel.sourceId;
          if (!visited.has(nextId)) {
            queue.push({ nodeId: nextId, depth: depth + 1 });
          }
        }
      }
    }

    return connectedNodes;
  }

  async findShortestPath(sourceId: string, targetId: string): Promise<KnowledgeRelationship[]> {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: KnowledgeRelationship[] }> = [
      { nodeId: sourceId, path: [] },
    ];

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!;

      if (nodeId === targetId) {
        return path;
      }

      if (visited.has(nodeId)) {continue;}
      visited.add(nodeId);

      const relationships = await this.getNodeRelationships(nodeId);
      for (const rel of relationships) {
        const nextId = rel.sourceId === nodeId ? rel.targetId : rel.sourceId;
        if (!visited.has(nextId)) {
          queue.push({ nodeId: nextId, path: [...path, rel] });
        }
      }
    }

    return [];
  }

  // Index Operations
  private updateIndexes(node: KnowledgeNode, operation: 'create' | 'update' | 'delete'): void {
    if (!this.config.indexing.enabled) {return;}

    this.config.indexing.indexFields.forEach((field) => {
      const indexKey = field;
      const index = this.indexes.get(indexKey);
      if (!index) {return;}

      const value = this.getFieldValue(node, field);
      if (value !== undefined) {
        const valueKey = String(value);
        if (!index.has(valueKey)) {
          index.set(valueKey, new Set());
        }

        if (operation === 'delete') {
          index.get(valueKey)!.delete(node.id);
          if (index.get(valueKey)!.size === 0) {
            index.delete(valueKey);
          }
        } else {
          index.get(valueKey)!.add(node.id);
        }
      }
    });

    // Update type index
    const typeIndexKey = `type:${node.type}`;
    const typeIndex = this.indexes.get(typeIndexKey);
    if (typeIndex) {
      if (operation === 'delete') {
        typeIndex.delete(node.id);
      } else {
        typeIndex.set(node.id, new Set([node.id]));
      }
    }
  }

  private getFieldValue(node: KnowledgeNode, field: string): any {
    const fieldPath = field.split('.');
    let value: any = node;

    for (const path of fieldPath) {
      if (value && typeof value === 'object' && path in value) {
        value = value[path];
      } else {
        return undefined;
      }
    }

    return value;
  }

  // Filter and Sort Operations
  private applyFilters(nodes: KnowledgeNode[], filters: QueryFilter[]): KnowledgeNode[] {
    return nodes.filter((node) => {
      return filters.every((filter) => {
        const fieldValue = this.getFieldValue(node, filter.field);
        return this.evaluateFilter(fieldValue, filter);
      });
    });
  }

  private evaluateFilter(fieldValue: any, filter: QueryFilter): boolean {
    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return fieldValue === filter.value;
      case FilterOperator.NOT_EQUALS:
        return fieldValue !== filter.value;
      case FilterOperator.GREATER_THAN:
        return fieldValue > filter.value;
      case FilterOperator.LESS_THAN:
        return fieldValue < filter.value;
      case FilterOperator.GREATER_EQUAL:
        return fieldValue >= filter.value;
      case FilterOperator.LESS_EQUAL:
        return fieldValue <= filter.value;
      case FilterOperator.CONTAINS:
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(filter.value);
        }
        return String(fieldValue).includes(String(filter.value));
      case FilterOperator.NOT_CONTAINS:
        if (Array.isArray(fieldValue)) {
          return !fieldValue.includes(filter.value);
        }
        return !String(fieldValue).includes(String(filter.value));
      case FilterOperator.STARTS_WITH:
        return String(fieldValue).startsWith(String(filter.value));
      case FilterOperator.ENDS_WITH:
        return String(fieldValue).endsWith(String(filter.value));
      case FilterOperator.IN:
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case FilterOperator.NOT_IN:
        return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
      case FilterOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
      case FilterOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null;
      case FilterOperator.REGEX:
        return new RegExp(filter.value).test(String(fieldValue));
      case FilterOperator.RANGE:
        const [min, max] = filter.value;
        return fieldValue >= min && fieldValue <= max;
      default:
        return true;
    }
  }

  private applySorting(nodes: KnowledgeNode[], sortOptions: SortOption[]): KnowledgeNode[] {
    return nodes.sort((a, b) => {
      for (const sort of sortOptions) {
        const aValue = this.getFieldValue(a, sort.field);
        const bValue = this.getFieldValue(b, sort.field);

        if (aValue < bValue) {
          return sort.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sort.direction === 'asc' ? 1 : -1;
        }
      }
      return 0;
    });
  }

  // Statistics Operations
  private updateStatistics(): void {
    this.statistics.totalNodes = this.nodes.size;
    this.statistics.totalRelationships = this.relationships.size;

    // Update node type counts
    this.statistics.nodeTypes.clear();
    for (const node of this.nodes.values()) {
      const count = this.statistics.nodeTypes.get(node.type) || 0;
      this.statistics.nodeTypes.set(node.type, count + 1);
    }

    // Update relationship type counts
    this.statistics.relationshipTypes.clear();
    for (const rel of this.relationships.values()) {
      const count = this.statistics.relationshipTypes.get(rel.type) || 0;
      this.statistics.relationshipTypes.set(rel.type, count + 1);
    }

    // Calculate average degree
    const totalDegree = Array.from(this.nodes.keys()).reduce((sum, nodeId) => {
      const relationships = Array.from(this.relationships.values()).filter(
        (rel) => rel.sourceId === nodeId || rel.targetId === nodeId,
      );
      return sum + relationships.length;
    }, 0);
    this.statistics.averageDegree = this.nodes.size > 0 ? totalDegree / this.nodes.size : 0;

    // Calculate density
    const maxEdges = this.nodes.size * (this.nodes.size - 1);
    this.statistics.density = maxEdges > 0 ? this.relationships.size / maxEdges : 0;

    // Calculate connected components (simplified)
    this.statistics.connectedComponents = this.calculateConnectedComponents();
  }

  private calculateConnectedComponents(): number {
    const visited = new Set<string>();
    let components = 0;

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        this.dfs(nodeId, visited);
        components++;
      }
    }

    return components;
  }

  private dfs(nodeId: string, visited: Set<string>): void {
    visited.add(nodeId);

    const relationships = Array.from(this.relationships.values()).filter(
      (rel) => rel.sourceId === nodeId || rel.targetId === nodeId,

    for (const rel of relationships) {
      const nextId = rel.sourceId === nodeId ? rel.targetId : rel.sourceId;
      if (!visited.has(nextId)) {
        this.dfs(nextId, visited);
      }
    }
  }

  // Utility Operations
  private generateId(): string {
    return `kg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async clear(): Promise<void> {
    this.nodes.clear();
    this.relationships.clear();
    this.indexes.clear();
    this.initializeIndexes();
    this.statistics = this.initializeStatistics();
  }

  async export(): Promise<KnowledgeGraph> {
    return {
      nodes: new Map(this.nodes),
      relationships: new Map(this.relationships),
      indexes: new Map(this.indexes),
      statistics: this.statistics,
    };
  }

  async import(graph: KnowledgeGraph): Promise<void> {
    this.nodes = new Map(graph.nodes);
    this.relationships = new Map(graph.relationships);
    this.indexes = new Map(graph.indexes);
    this.statistics = graph.statistics;
  }
}
