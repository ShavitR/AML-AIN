// Communication Layer Types and Interfaces

export interface Message {
  id: string;
  type: MessageType;
  sender: string;
  recipient: string | string[];
  timestamp: number;
  payload: any;
  metadata: MessageMetadata;
  priority: MessagePriority;
  version: string;
  correlationId?: string;
  parentId?: string;
  expiresAt?: number;
}

export interface MessageMetadata {
  compression?: boolean;
  encryption?: boolean;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  tags?: string[];
  source?: string;
  destination?: string;
  routing?: RoutingInfo;
}

export interface RoutingInfo {
  route: string[];
  hops: number;
  maxHops: number;
  routingTable?: Record<string, string>;
}

export enum MessageType {
  // System messages
  HEARTBEAT = 'heartbeat',
  REGISTER = 'register',
  UNREGISTER = 'unregister',
  DISCOVER = 'discover',
  CAPABILITY_QUERY = 'capability_query',
  CAPABILITY_RESPONSE = 'capability_response',
  
  // Task messages
  TASK_REQUEST = 'task_request',
  TASK_RESPONSE = 'task_response',
  TASK_PROGRESS = 'task_progress',
  TASK_COMPLETE = 'task_complete',
  TASK_ERROR = 'task_error',
  TASK_CANCEL = 'task_cancel',
  
  // Knowledge messages
  KNOWLEDGE_SHARE = 'knowledge_share',
  KNOWLEDGE_REQUEST = 'knowledge_request',
  KNOWLEDGE_RESPONSE = 'knowledge_response',
  KNOWLEDGE_UPDATE = 'knowledge_update',
  
  // Control messages
  CONTROL_START = 'control_start',
  CONTROL_STOP = 'control_stop',
  CONTROL_PAUSE = 'control_pause',
  CONTROL_RESUME = 'control_resume',
  
  // Error messages
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  
  // Custom messages
  CUSTOM = 'custom'
}

export enum MessagePriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  URGENT = 4,
  CRITICAL = 5
}

export interface MessageSchema {
  type: string;
  required: string[];
  properties: Record<string, any>;
  additionalProperties?: boolean;
}

export interface MessageValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MessageEncryptionConfig {
  algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  keySize: number;
  ivSize: number;
  tagSize: number;
}

export interface MessageCompressionConfig {
  algorithm: 'gzip' | 'brotli' | 'lz4' | 'zstd';
  level: number;
  threshold: number; // Minimum size to compress
}

export interface MessageRoutingRule {
  id: string;
  name: string;
  conditions: RoutingCondition[];
  actions: RoutingAction[];
  priority: number;
  enabled: boolean;
}

export interface RoutingCondition {
  field: string;
  operator: 'equals' | 'contains' | 'regex' | 'range' | 'exists';
  value: any;
}

export interface RoutingAction {
  type: 'route' | 'filter' | 'transform' | 'log' | 'delay';
  parameters: Record<string, any>;
}

export interface MessageBatch {
  id: string;
  messages: Message[];
  batchSize: number;
  createdAt: number;
  expiresAt?: number;
}

export interface MessageAcknowledgment {
  messageId: string;
  acknowledgedBy: string;
  timestamp: number;
  status: 'ack' | 'nack' | 'reject';
  reason?: string;
}

export interface MessageFlowControl {
  windowSize: number;
  currentWindow: number;
  backpressure: boolean;
  flowRate: number; // messages per second
}

export interface MessageMetrics {
  sent: number;
  received: number;
  acknowledged: number;
  failed: number;
  latency: number[];
  throughput: number;
  errorRate: number;
}

export interface DeadLetterMessage {
  originalMessage: Message;
  error: string;
  failedAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: number;
} 