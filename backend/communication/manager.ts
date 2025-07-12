// Main Communication Manager

import { Message, MessageType, MessagePriority } from './types';
import { MessageSerializer, SerializationOptions, DeserializationOptions } from './serializer';
import { MessageRouter } from './router';
import { MessageValidator } from './validator';
import { MessageQueue, QueueConfig } from './queue';
import { EventEmitter } from 'events';

export interface CommunicationConfig {
  serializer: {
    defaultFormat: 'json' | 'msgpack' | 'protobuf' | 'avro';
    compression: boolean;
    encryption: boolean;
  };
  router: {
    enableRouting: boolean;
    enableCaching: boolean;
    maxHops: number;
  };
  validator: {
    enableValidation: boolean;
    strictMode: boolean;
  };
  queue: QueueConfig;
}

export interface CommunicationStats {
  messagesSent: number;
  messagesReceived: number;
  messagesProcessed: number;
  messagesFailed: number;
  averageLatency: number;
  throughput: number;
  queueStats: any;
  routingStats: any;
}

export class CommunicationManager extends EventEmitter {
  private serializer: MessageSerializer;
  private router: MessageRouter;
  private validator: MessageValidator;
  private queue: MessageQueue;
  private config: CommunicationConfig;
  private stats: CommunicationStats;
  private agentId: string;

  constructor(agentId: string, config: Partial<CommunicationConfig> = {}) {
    super();
    
    this.agentId = agentId;
    this.config = {
      serializer: {
        defaultFormat: 'json',
        compression: false,
        encryption: false
      },
      router: {
        enableRouting: true,
        enableCaching: true,
        maxHops: 10
      },
      validator: {
        enableValidation: true,
        strictMode: false
      },
      queue: {
        maxSize: 10000,
        maxBatchSize: 100,
        processingTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        deadLetterQueue: true,
        priorityQueues: true,
        flowControl: true
      },
      ...config
    };

    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
      averageLatency: 0,
      throughput: 0,
      queueStats: {},
      routingStats: {}
    };

    // Initialize components
    this.serializer = MessageSerializer.getInstance();
    this.router = new MessageRouter();
    this.validator = MessageValidator.getInstance();
    this.queue = new MessageQueue(this.config.queue);

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Send a message
   */
  public async sendMessage(
    type: MessageType,
    recipient: string | string[],
    payload: any,
    options: Partial<Message> = {}
  ): Promise<string> {
    try {
      // Create message
      const message = this.serializer.createMessage(type, this.agentId, recipient, payload, options);

      // Validate message
      if (this.config.validator.enableValidation) {
        const validation = this.validator.validateMessage(message);
        if (!validation.valid) {
          throw new Error(`Message validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Route message
      if (this.config.router.enableRouting) {
        const route = this.router.routeMessage(message);
        message.recipient = route;
      }

      // Serialize message
      const serialized = this.serializer.serialize(message, {
        format: this.config.serializer.defaultFormat,
        compression: this.config.serializer.compression,
        encryption: this.config.serializer.encryption
      });

      // Enqueue for sending
      const enqueued = this.queue.enqueue(message);
      if (!enqueued) {
        throw new Error('Failed to enqueue message - queue full or backpressure active');
      }

      this.stats.messagesSent++;
      this.emit('messageSent', { message, serialized });

      return message.id;

    } catch (error) {
      this.stats.messagesFailed++;
      this.emit('sendError', { 
        type, 
        recipient, 
        payload, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Receive and process a message
   */
  public async receiveMessage(data: Buffer, options: Partial<DeserializationOptions> = {}): Promise<Message> {
    try {
      // Deserialize message
      const deserializationOptions: DeserializationOptions = {
        format: this.config.serializer.defaultFormat,
        decompress: this.config.serializer.compression,
        decrypt: this.config.serializer.encryption,
        validateSchema: this.config.validator.enableValidation,
        strict: this.config.validator.strictMode,
        ...options
      };

      const message = this.serializer.deserialize(data, deserializationOptions);

      // Validate message
      if (this.config.validator.enableValidation) {
        const validation = this.validator.validateMessage(message);
        if (!validation.valid) {
          throw new Error(`Message validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Check if message is for this agent
      const recipients = Array.isArray(message.recipient) ? message.recipient : [message.recipient];
      if (!recipients.includes(this.agentId) && !recipients.includes('*')) {
        throw new Error(`Message not intended for this agent: ${this.agentId}`);
      }

      this.stats.messagesReceived++;
      this.emit('messageReceived', { message, data });

      // Process message
      await this.processMessage(message);

      return message;

    } catch (error) {
      this.stats.messagesFailed++;
      this.emit('receiveError', { 
        data, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Process a received message
   */
  private async processMessage(message: Message): Promise<void> {
    try {
      const startTime = Date.now();

      // Emit message for processing
      this.emit('messageProcess', { message });

      // Handle different message types
      switch (message.type) {
        case MessageType.HEARTBEAT:
          await this.handleHeartbeat(message);
          break;
        case MessageType.REGISTER:
          await this.handleRegister(message);
          break;
        case MessageType.UNREGISTER:
          await this.handleUnregister(message);
          break;
        case MessageType.DISCOVER:
          await this.handleDiscover(message);
          break;
        case MessageType.CAPABILITY_QUERY:
          await this.handleCapabilityQuery(message);
          break;
        case MessageType.TASK_REQUEST:
          await this.handleTaskRequest(message);
          break;
        case MessageType.KNOWLEDGE_REQUEST:
          await this.handleKnowledgeRequest(message);
          break;
        default:
          // Emit for custom handlers
          this.emit('customMessage', { message });
          break;
      }

      this.stats.messagesProcessed++;
      const processingTime = Date.now() - startTime;
      this.updateLatency(processingTime);

      this.emit('messageProcessed', { message, processingTime });

    } catch (error) {
      this.stats.messagesFailed++;
      this.emit('processError', { 
        message, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Handle heartbeat messages
   */
  private async handleHeartbeat(message: Message): Promise<void> {
    // Send heartbeat response
    const response = this.serializer.createMessage(
      MessageType.HEARTBEAT,
      message.sender,
      message.sender,
      { status: 'alive', timestamp: Date.now() },
      {}
    );

    await this.sendMessage(MessageType.HEARTBEAT, message.sender, {
      status: 'alive',
      timestamp: Date.now()
    });
  }

  /**
   * Handle agent registration
   */
  private async handleRegister(message: Message): Promise<void> {
    const { agentId, address, capabilities } = message.payload;
    
    this.router.registerAgent(agentId, address, capabilities);
    
    // Send registration confirmation
    await this.sendMessage(MessageType.REGISTER, message.sender, {
      status: 'registered',
      agentId: this.agentId
    });
  }

  /**
   * Handle agent unregistration
   */
  private async handleUnregister(message: Message): Promise<void> {
    const { agentId } = message.payload;
    
    this.router.unregisterAgent(agentId);
    
    // Send unregistration confirmation
    await this.sendMessage(MessageType.UNREGISTER, message.sender, {
      status: 'unregistered',
      agentId: this.agentId
    });
  }

  /**
   * Handle discovery requests
   */
  private async handleDiscover(message: Message): Promise<void> {
    const routingTable = this.router.getRoutingTable();
    
    await this.sendMessage(MessageType.DISCOVER, message.sender, {
      agents: Object.keys(routingTable),
      routingTable
    });
  }

  /**
   * Handle capability queries
   */
  private async handleCapabilityQuery(message: Message): Promise<void> {
    // This would be implemented based on agent capabilities
    const capabilities = ['system', 'general']; // Default capabilities
    
    await this.sendMessage(MessageType.CAPABILITY_RESPONSE, message.sender, {
      agentId: this.agentId,
      capabilities
    });
  }

  /**
   * Handle task requests
   */
  private async handleTaskRequest(message: Message): Promise<void> {
    // Emit for task processing
    this.emit('taskRequest', { message });
  }

  /**
   * Handle knowledge requests
   */
  private async handleKnowledgeRequest(message: Message): Promise<void> {
    // Emit for knowledge processing
    this.emit('knowledgeRequest', { message });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Queue events
    this.queue.on('messageEnqueued', (data) => {
      this.emit('queueMessageEnqueued', data);
    });

    this.queue.on('batchReady', (data) => {
      this.emit('queueBatchReady', data);
    });

    this.queue.on('flowControlBackpressure', (data) => {
      this.emit('flowControlBackpressure', data);
    });

    // Router events
    this.router.on('messageRouted', (data) => {
      this.emit('routerMessageRouted', data);
    });

    this.router.on('routingError', (data) => {
      this.emit('routerError', data);
    });

    this.router.on('agentRegistered', (data) => {
      this.emit('agentRegistered', data);
    });

    this.router.on('agentUnregistered', (data) => {
      this.emit('agentUnregistered', data);
    });
  }

  /**
   * Update latency statistics
   */
  private updateLatency(latency: number): void {
    const totalLatency = this.stats.averageLatency * (this.stats.messagesProcessed - 1) + latency;
    this.stats.averageLatency = totalLatency / this.stats.messagesProcessed;
  }

  /**
   * Get communication statistics
   */
  public getStats(): CommunicationStats {
    return {
      ...this.stats,
      queueStats: this.queue.getStats(),
      routingStats: this.router.getMetrics()
    };
  }

  /**
   * Get routing table
   */
  public getRoutingTable(): any {
    return this.router.getRoutingTable();
  }

  /**
   * Register an agent
   */
  public registerAgent(agentId: string, address: string, capabilities: string[]): void {
    this.router.registerAgent(agentId, address, capabilities);
  }

  /**
   * Unregister an agent
   */
  public unregisterAgent(agentId: string): void {
    this.router.unregisterAgent(agentId);
  }

  /**
   * Update agent status
   */
  public updateAgentStatus(agentId: string, status: 'online' | 'offline' | 'busy'): void {
    this.router.updateAgentStatus(agentId, status);
  }

  /**
   * Add routing rule
   */
  public addRoutingRule(rule: any): void {
    this.router.addRoutingRule(rule);
  }

  /**
   * Remove routing rule
   */
  public removeRoutingRule(ruleId: string): void {
    this.router.removeRoutingRule(ruleId);
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): any {
    return this.queue.getStats();
  }

  /**
   * Get flow control status
   */
  public getFlowControl(): any {
    return this.queue.getFlowControl();
  }

  /**
   * Update flow control settings
   */
  public updateFlowControl(flowControl: any): void {
    this.queue.updateFlowControl(flowControl);
  }

  /**
   * Get dead letter queue
   */
  public getDeadLetterQueue(): any[] {
    return this.queue.getDeadLetterQueue();
  }

  /**
   * Clear dead letter queue
   */
  public clearDeadLetterQueue(): void {
    this.queue.clearDeadLetterQueue();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CommunicationConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update queue config if provided
    if (config.queue) {
      this.queue.updateConfig(config.queue);
    }
    
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Shutdown communication manager
   */
  public async shutdown(): Promise<void> {
    try {
      // Stop queue processing
      this.queue.stopProcessing();
      
      // Clear routing table
      const routingTable = this.router.getRoutingTable();
      for (const agentId of Object.keys(routingTable)) {
        this.router.unregisterAgent(agentId);
      }
      
      // Drain queue
      this.queue.drain();
      
      this.emit('shutdown');
    } catch (error) {
      this.emit('shutdownError', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }
} 