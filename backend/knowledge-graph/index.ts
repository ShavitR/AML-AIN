// Import types for configuration
import { KnowledgeGraphConfig, KnowledgeNodeType } from './types';

// Export all types and interfaces
export * from './types';

// Export core classes
export { KnowledgeGraphDatabase } from './database';
export { KnowledgeValidator } from './validator';
export { KnowledgeIngestionPipeline } from './ingestion';

// Default configuration
export const defaultKnowledgeGraphConfig = {
  storage: {
    type: 'memory' as const,
    maxSize: 10000,
    compression: false,
    encryption: false,
  },
  indexing: {
    enabled: true,
    autoIndex: true,
    indexTypes: [
      KnowledgeNodeType.CONCEPT,
      KnowledgeNodeType.FACT,
      KnowledgeNodeType.RULE,
      KnowledgeNodeType.PROCEDURE,
      KnowledgeNodeType.EXAMPLE,
      KnowledgeNodeType.DEFINITION,
      KnowledgeNodeType.THEOREM,
      KnowledgeNodeType.ALGORITHM,
      KnowledgeNodeType.DATASET,
      KnowledgeNodeType.MODEL,
      KnowledgeNodeType.DOCUMENT,
      KnowledgeNodeType.CODE,
      KnowledgeNodeType.IMAGE,
      KnowledgeNodeType.AUDIO,
      KnowledgeNodeType.VIDEO,
      KnowledgeNodeType.USER,
      KnowledgeNodeType.AGENT,
      KnowledgeNodeType.TASK,
      KnowledgeNodeType.RESULT,
      KnowledgeNodeType.METADATA,
    ],
    indexFields: [
      'type',
      'metadata.title',
      'metadata.description',
      'metadata.author',
      'metadata.domain',
      'tags',
      'confidence',
      'source',
    ],
    updateInterval: 1000,
  },
  validation: {
    enabled: true,
    strictMode: false,
    validateOnIngestion: true,
    validateOnUpdate: true,
    customValidators: [],
  },
  security: {
    enabled: true,
    encryption: false,
    accessControl: true,
    auditLogging: true,
    rateLimiting: true,
  },
  performance: {
    cacheSize: 1000,
    cacheTTL: 300000, // 5 minutes
    maxQueryComplexity: 100,
    timeout: 30000, // 30 seconds
    batchSize: 100,
  },
  backup: {
    enabled: true,
    interval: 3600000, // 1 hour
    retention: 7, // 7 days
    compression: true,
    encryption: false,
    location: './backups',
  },
};

// Main Knowledge Graph Service class
import { KnowledgeGraphDatabase } from './database';
import { KnowledgeValidator } from './validator';
import { KnowledgeIngestionPipeline } from './ingestion';
import { ConflictResolutionEngine } from './conflict-resolution';
import { KnowledgeCompressionEngine } from './compression';
import { KnowledgeVisualizationEngine } from './visualization';
import { KnowledgeSharingEngine } from './sharing';

export class KnowledgeGraphService {
  private database: KnowledgeGraphDatabase;
  private validator: KnowledgeValidator;
  private ingestionPipeline: KnowledgeIngestionPipeline;
  private conflictEngine: ConflictResolutionEngine;
  private compressionEngine: KnowledgeCompressionEngine;
  private visualizationEngine: KnowledgeVisualizationEngine;
  private sharingEngine: KnowledgeSharingEngine;

  constructor(config: Partial<KnowledgeGraphConfig> = {}) {
    const fullConfig = this.mergeConfig(defaultKnowledgeGraphConfig, config);
    this.database = new KnowledgeGraphDatabase(fullConfig);
    this.validator = new KnowledgeValidator(this.database);
    this.ingestionPipeline = new KnowledgeIngestionPipeline(this.database, this.validator);
    this.conflictEngine = new ConflictResolutionEngine();
    this.compressionEngine = new KnowledgeCompressionEngine();
    this.visualizationEngine = new KnowledgeVisualizationEngine();
    this.sharingEngine = new KnowledgeSharingEngine();
  }

  private mergeConfig(
    defaultConfig: KnowledgeGraphConfig,
    userConfig: Partial<KnowledgeGraphConfig>,
  ): KnowledgeGraphConfig {
    return {
      storage: { ...defaultConfig.storage, ...userConfig.storage },
      indexing: { ...defaultConfig.indexing, ...userConfig.indexing },
      validation: { ...defaultConfig.validation, ...userConfig.validation },
      security: { ...defaultConfig.security, ...userConfig.security },
      performance: { ...defaultConfig.performance, ...userConfig.performance },
      backup: { ...defaultConfig.backup, ...userConfig.backup },
    };
  }

  // Database operations
  getDatabase(): KnowledgeGraphDatabase {
    return this.database;
  }

  // Validator operations
  getValidator(): KnowledgeValidator {
    return this.validator;
  }

  // Ingestion operations
  getIngestionPipeline(): KnowledgeIngestionPipeline {
    return this.ingestionPipeline;
  }

  // Convenience methods
  async createNode(nodeData: any) {
    return this.database.createNode(nodeData);
  }

  async getNode(id: string) {
    return this.database.getNode(id);
  }

  async updateNode(id: string, updates: any) {
    return this.database.updateNode(id, updates);
  }

  async deleteNode(id: string) {
    return this.database.deleteNode(id);
  }

  async createRelationship(relationshipData: any) {
    return this.database.createRelationship(relationshipData);
  }

  async getRelationship(id: string) {
    return this.database.getRelationship(id);
  }

  async updateRelationship(id: string, updates: any) {
    return this.database.updateRelationship(id, updates);
  }

  async deleteRelationship(id: string) {
    return this.database.deleteRelationship(id);
  }

  async search(query: string, options: any = {}) {
    return this.database.search(query, options);
  }

  async searchByType(type: string, options: any = {}) {
    return this.database.searchByType(type as any, options);
  }

  async searchByTag(tag: string, options: any = {}) {
    return this.database.searchByTag(tag, options);
  }

  async getGraphStatistics() {
    return this.database.getGraphStatistics();
  }

  async getConnectedNodes(nodeId: string, maxDepth: number = 1) {
    return this.database.getConnectedNodes(nodeId, maxDepth);
  }

  async findShortestPath(sourceId: string, targetId: string) {
    return this.database.findShortestPath(sourceId, targetId);
  }

  // Validation methods
  async validateNode(node: any) {
    return this.validator.validateNode(node);
  }

  async validateRelationship(relationship: any) {
    return this.validator.validateRelationship(relationship);
  }

  async validateIngestionData(data: any) {
    return this.validator.validateIngestionData(data);
  }

  // Ingestion methods
  async ingest(source: any, options: any = {}) {
    return this.ingestionPipeline.ingest(source, options);
  }

  async ingestFromFile(filePath: string, options: any = {}) {
    return this.ingestionPipeline.ingestFromFile(filePath, options);
  }

  async ingestFromAPI(apiUrl: string, options: any = {}) {
    return this.ingestionPipeline.ingestFromAPI(apiUrl, options);
  }

  // Advanced Conflict Resolution
  async detectConflicts(node1: any, node2: any) {
    return this.conflictEngine.detectConflicts(node1, node2);
  }

  async mergeNodes(node1: any, node2: any, strategy?: string) {
    return this.conflictEngine.mergeNodes(node1, node2, strategy);
  }

  getVersionHistory(nodeId: string) {
    return this.conflictEngine.getVersionHistory(nodeId);
  }

  getConflictLog() {
    return this.conflictEngine.getConflictLog();
  }

  // Compression
  async compressNode(node: any) {
    return this.compressionEngine.compressNode(node);
  }

  async decompressNode(compressedData: Buffer, algorithm: string) {
    return this.compressionEngine.decompressNode(compressedData, algorithm);
  }

  async compressGraph(graph: any) {
    return this.compressionEngine.compressGraph(graph);
  }

  getCompressionStats() {
    return this.compressionEngine.getStats();
  }

  // Visualization
  async generateLayout(graph: any, algorithm?: string) {
    return this.visualizationEngine.generateLayout(graph, algorithm);
  }

  async calculateMetrics(graph: any) {
    return this.visualizationEngine.calculateMetrics(graph);
  }

  getLayout(layoutId: string) {
    return this.visualizationEngine.getLayout(layoutId);
  }

  // Sharing and Federation
  async federateWithNode(nodeUrl: string, capabilities: string[] = []) {
    return this.sharingEngine.federateWithNode(nodeUrl, capabilities);
  }

  async syncWithFederation(graph: any) {
    return this.sharingEngine.syncWithFederation(graph);
  }

  async replicateGraph(graph: any, targetNode: string) {
    return this.sharingEngine.replicateGraph(graph, targetNode);
  }

  async startContinuousSync(graph: any) {
    return this.sharingEngine.startContinuousSync(graph);
  }

  async broadcastUpdate(graph: any, update: any) {
    return this.sharingEngine.broadcastUpdate(graph, update);
  }

  getFederationNodes() {
    return this.sharingEngine.getFederationNodes();
  }

  getSyncHistory() {
    return this.sharingEngine.getSyncHistory();
  }

  // Utility methods
  async clear() {
    return this.database.clear();
  }

  async export() {
    return this.database.export();
  }

  async import(graph: any) {
    return this.database.import(graph);
  }
}

// Factory function to create a knowledge graph service
export function createKnowledgeGraphService(
  config?: Partial<KnowledgeGraphConfig>,
): KnowledgeGraphService {
  return new KnowledgeGraphService(config);
}

// Export commonly used types for convenience
export type {
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeQuery,
  KnowledgeSearchResult,
  KnowledgeIngestionResult,
  KnowledgeValidationResult,
} from './types';

export { KnowledgeNodeType, RelationshipType, FilterOperator } from './types';
