export interface KnowledgeNode {
  id: string;
  type: KnowledgeNodeType;
  content: any;
  metadata: KnowledgeMetadata;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  source: string;
  confidence: number;
  tags: string[];
  accessControl: AccessControl;
}

export interface KnowledgeMetadata {
  title?: string;
  description?: string;
  author?: string;
  domain?: string;
  language?: string;
  format?: string;
  size?: number;
  checksum?: string;
  dependencies?: string[];
  references?: string[];
  quality?: QualityMetrics;
}

export interface QualityMetrics {
  accuracy: number;
  completeness: number;
  consistency: number;
  timeliness: number;
  relevance: number;
  overall: number;
}

export interface AccessControl {
  owner: string;
  permissions: Permission[];
  groups: string[];
  public: boolean;
}

export interface Permission {
  subject: string;
  actions: string[];
  conditions?: any;
}

export interface KnowledgeRelationship {
  id: string;
  sourceId: string;
  targetId: string;
  type: RelationshipType;
  weight: number;
  metadata: RelationshipMetadata;
  createdAt: Date;
  updatedAt: Date;
}

export interface RelationshipMetadata {
  description?: string;
  confidence: number;
  evidence?: string[];
  context?: any;
}

export interface KnowledgeQuery {
  filters: QueryFilter[];
  sort: SortOption[];
  limit: number;
  offset: number;
  includeRelationships: boolean;
  includeMetadata: boolean;
}

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value: any;
}

export interface SortOption {
  field: string;
  direction: 'asc' | 'desc';
}

export interface KnowledgeSearchResult {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  total: number;
  query: KnowledgeQuery;
  executionTime: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  relationships: Map<string, KnowledgeRelationship>;
  indexes: Map<string, any>;
  statistics: GraphStatistics;
}

export interface GraphStatistics {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: Map<KnowledgeNodeType, number>;
  relationshipTypes: Map<RelationshipType, number>;
  averageDegree: number;
  density: number;
  connectedComponents: number;
}

export interface KnowledgeIngestionResult {
  success: boolean;
  nodesCreated: number;
  nodesUpdated: number;
  relationshipsCreated: number;
  relationshipsUpdated: number;
  errors: IngestionError[];
  warnings: string[];
}

export interface IngestionError {
  type: string;
  message: string;
  data?: any;
  line?: number;
}

export interface KnowledgeValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationError {
  type: string;
  message: string;
  nodeId?: string;
  relationshipId?: string;
  field?: string;
  value?: any;
  line?: number;
}

export interface KnowledgeBackup {
  version: string;
  timestamp: Date;
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  metadata: BackupMetadata;
}

export interface BackupMetadata {
  description: string;
  source: string;
  compression: boolean;
  encryption: boolean;
  checksum: string;
}

export interface KnowledgeAnalytics {
  nodeCount: number;
  relationshipCount: number;
  topNodeTypes: Array<{ type: KnowledgeNodeType; count: number }>;
  topRelationshipTypes: Array<{ type: RelationshipType; count: number }>;
  averageQuality: number;
  growthRate: number;
  accessPatterns: AccessPattern[];
  popularNodes: Array<{ nodeId: string; accessCount: number }>;
}

export interface AccessPattern {
  pattern: string;
  frequency: number;
  lastAccess: Date;
  users: string[];
}

export enum KnowledgeNodeType {
  CONCEPT = 'concept',
  FACT = 'fact',
  RULE = 'rule',
  PROCEDURE = 'procedure',
  EXAMPLE = 'example',
  DEFINITION = 'definition',
  THEOREM = 'theorem',
  ALGORITHM = 'algorithm',
  DATASET = 'dataset',
  MODEL = 'model',
  DOCUMENT = 'document',
  CODE = 'code',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  USER = 'user',
  AGENT = 'agent',
  TASK = 'task',
  RESULT = 'result',
  METADATA = 'metadata'
}

export enum RelationshipType {
  IS_A = 'is_a',
  PART_OF = 'part_of',
  DEPENDS_ON = 'depends_on',
  SIMILAR_TO = 'similar_to',
  OPPOSITE_OF = 'opposite_of',
  CAUSES = 'causes',
  LEADS_TO = 'leads_to',
  IMPLEMENTS = 'implements',
  USES = 'uses',
  CREATES = 'creates',
  VALIDATES = 'validates',
  EXTENDS = 'extends',
  INHERITS = 'inherits',
  ASSOCIATED_WITH = 'associated_with',
  LOCATED_IN = 'located_in',
  OCCURS_AT = 'occurs_at',
  PERFORMED_BY = 'performed_by',
  APPLIES_TO = 'applies_to',
  DERIVED_FROM = 'derived_from',
  VERSION_OF = 'version_of'
}

export enum FilterOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_EQUAL = 'greater_equal',
  LESS_EQUAL = 'less_equal',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IN = 'in',
  NOT_IN = 'not_in',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists',
  REGEX = 'regex',
  RANGE = 'range'
}

export interface KnowledgeGraphConfig {
  storage: StorageConfig;
  indexing: IndexingConfig;
  validation: ValidationConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  backup: BackupConfig;
}

export interface StorageConfig {
  type: 'memory' | 'database' | 'file';
  connectionString?: string;
  maxSize?: number;
  compression?: boolean;
  encryption?: boolean;
}

export interface IndexingConfig {
  enabled: boolean;
  autoIndex: boolean;
  indexTypes: KnowledgeNodeType[];
  indexFields: string[];
  updateInterval: number;
}

export interface ValidationConfig {
  enabled: boolean;
  strictMode: boolean;
  validateOnIngestion: boolean;
  validateOnUpdate: boolean;
  customValidators: string[];
}

export interface SecurityConfig {
  enabled: boolean;
  encryption: boolean;
  accessControl: boolean;
  auditLogging: boolean;
  rateLimiting: boolean;
}

export interface PerformanceConfig {
  cacheSize: number;
  cacheTTL: number;
  maxQueryComplexity: number;
  timeout: number;
  batchSize: number;
}

export interface BackupConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  compression: boolean;
  encryption: boolean;
  location: string;
}

// Note: KnowledgeGraphDatabase is exported from database.ts 