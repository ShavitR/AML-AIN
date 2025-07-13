// Message Queue and Flow Control System

import { Message, MessagePriority, MessageBatch, MessageAcknowledgment, MessageFlowControl, DeadLetterMessage } from './types';
import { EventEmitter } from 'events';

export interface QueueConfig {
  maxSize: number;
  maxBatchSize: number;
  processingTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  deadLetterQueue: boolean;
  priorityQueues: boolean;
  flowControl: boolean;
}

export interface QueueStats {
  size: number;
  processed: number;
  failed: number;
  retried: number;
  deadLetter: number;
  averageProcessingTime: number;
  throughput: number;
}

export class MessageQueue extends EventEmitter {
  private queues: Map<MessagePriority, Message[]> = new Map();
  private processingQueue: Message[] = [];
  private deadLetterQueue: DeadLetterMessage[] = [];
  private config: QueueConfig;
  private stats: QueueStats;
  private flowControl: MessageFlowControl;
  private processing: boolean = false;
  private batchProcessor: NodeJS.Timeout | undefined;

  constructor(config: Partial<QueueConfig> = {}) {
    super();
    
    this.config = {
      maxSize: 10000,
      maxBatchSize: 100,
      processingTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      deadLetterQueue: true,
      priorityQueues: true,
      flowControl: true,
      ...config
    };

    this.stats = {
      size: 0,
      processed: 0,
      failed: 0,
      retried: 0,
      deadLetter: 0,
      averageProcessingTime: 0,
      throughput: 0
    };

    this.flowControl = {
      windowSize: 100,
      currentWindow: 0,
      backpressure: false,
      flowRate: 1000 // messages per second
    };

    // Initialize priority queues
    if (this.config.priorityQueues) {
      for (let priority = MessagePriority.LOW; priority <= MessagePriority.CRITICAL; priority++) {
        this.queues.set(priority, []);
      }
    } else {
      this.queues.set(MessagePriority.NORMAL, []);
    }

    // Start processing
    this.startProcessing();
  }

  /**
   * Enqueue a message
   */
  public enqueue(message: Message): boolean {
    try {
      // Check flow control
      if (this.config.flowControl && this.flowControl.backpressure) {
        this.emit('flowControlBackpressure', { message, reason: 'Backpressure active' });
        return false;
      }

      // Check queue size
      if (this.stats.size >= this.config.maxSize) {
        this.emit('queueFull', { message, queueSize: this.stats.size });
        return false;
      }

      // Add to appropriate queue
      const queue = this.getQueue(message.priority);
      queue.push(message);
      this.stats.size++;

      // Update flow control
      if (this.config.flowControl) {
        this.flowControl.currentWindow++;
        if (this.flowControl.currentWindow >= this.flowControl.windowSize) {
          this.flowControl.backpressure = true;
          this.emit('flowControlBackpressure', { message, reason: 'Window full' });
        }
      }

      this.emit('messageEnqueued', { message, queueSize: this.stats.size });
      return true;

    } catch (error) {
      this.emit('enqueueError', { message, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Dequeue a message
   */
  public dequeue(): Message | null {
    try {
      // Get highest priority message
      for (let priority = MessagePriority.CRITICAL; priority >= MessagePriority.LOW; priority--) {
        const queue = this.queues.get(priority);
        if (queue && queue.length > 0) {
          const message = queue.shift()!;
          this.stats.size--;
          
          // Update flow control
          if (this.config.flowControl) {
            this.flowControl.currentWindow = Math.max(0, this.flowControl.currentWindow - 1);
            if (this.flowControl.backpressure && this.flowControl.currentWindow < this.flowControl.windowSize * 0.5) {
              this.flowControl.backpressure = false;
              this.emit('flowControlResumed');
            }
          }

          this.emit('messageDequeued', { message, queueSize: this.stats.size });
          return message;
        }
      }

      return null;

    } catch (error) {
      this.emit('dequeueError', { error: error instanceof Error ? error.message : 'Unknown error' });
      return null;
    }
  }

  /**
   * Process messages in batches
   */
  public async processBatch(batchSize: number = this.config.maxBatchSize): Promise<MessageBatch | null> {
    const messages: Message[] = [];
    const startTime = Date.now();

    // Collect messages for batch
    for (let i = 0; i < batchSize; i++) {
      const message = this.dequeue();
      if (!message) break;
      messages.push(message);
    }

    if (messages.length === 0) {
      return null;
    }

    // Create batch
    const batch: MessageBatch = {
      id: this.generateBatchId(),
      messages,
      batchSize: messages.length,
      createdAt: startTime,
      expiresAt: startTime + this.config.processingTimeout
    };

    this.emit('batchCreated', { batch });
    return batch;
  }

  /**
   * Acknowledge message processing
   */
  public acknowledge(messageId: string, acknowledgedBy: string, status: 'ack' | 'nack' | 'reject', reason?: string): void {
    const acknowledgment: MessageAcknowledgment = {
      messageId,
      acknowledgedBy,
      timestamp: Date.now(),
      status
    };
    
    if (reason) {
      acknowledgment.reason = reason;
    }

    this.stats.processed++;

    if (status === 'ack') {
      this.updateProcessingTime(Date.now());
    } else if (status === 'nack') {
      this.stats.failed++;
      this.handleRetry(messageId, reason);
    } else if (status === 'reject') {
      this.stats.failed++;
      this.moveToDeadLetter(messageId, reason);
    }

    this.emit('messageAcknowledged', { acknowledgment, stats: this.getStats() });
  }

  /**
   * Handle message retry
   */
  private handleRetry(messageId: string, reason?: string): void {
    // Find message in processing queue
    const messageIndex = this.processingQueue.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = this.processingQueue[messageIndex];
    if (!message) return;
    
    const retryCount = message.metadata.retryCount || 0;

    if (retryCount < this.config.retryAttempts) {
      // Retry message
      message.metadata.retryCount = retryCount + 1;
      message.metadata.timeout = (message.metadata.timeout || 0) + this.config.retryDelay;
      
      // Re-enqueue with higher priority
      const newPriority = Math.min(message.priority + 1, MessagePriority.CRITICAL);
      message.priority = newPriority;
      
      this.enqueue(message);
      this.stats.retried++;

      this.emit('messageRetried', { message, retryCount: retryCount + 1 });
    } else {
      // Move to dead letter queue
      this.moveToDeadLetter(messageId, `Max retries exceeded: ${reason}`);
    }

    // Remove from processing queue
    this.processingQueue.splice(messageIndex, 1);
  }

  /**
   * Move message to dead letter queue
   */
  private moveToDeadLetter(messageId: string, reason?: string): void {
    if (!this.config.deadLetterQueue) return;

    const messageIndex = this.processingQueue.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = this.processingQueue[messageIndex];
    if (!message) return;
    
    const deadLetterMessage: DeadLetterMessage = {
      originalMessage: message,
      error: reason || 'Unknown error',
      failedAt: Date.now(),
      retryCount: message.metadata.retryCount || 0,
      maxRetries: this.config.retryAttempts
    };

    this.deadLetterQueue.push(deadLetterMessage);
    this.stats.deadLetter++;

    // Remove from processing queue
    this.processingQueue.splice(messageIndex, 1);

    this.emit('messageDeadLettered', { deadLetterMessage });
  }

  /**
   * Start message processing
   */
  private startProcessing(): void {
    if (this.processing) return;

    this.processing = true;
    this.processMessages();
  }

  /**
   * Stop message processing
   */
  public stopProcessing(): void {
    this.processing = false;
    if (this.batchProcessor) {
      clearTimeout(this.batchProcessor);
      this.batchProcessor = undefined;
    }
    
    // Clear all queues to prevent memory leaks
    this.queues.clear();
    this.processingQueue = [];
    this.stats.size = 0;
    
    // Reset flow control
    this.flowControl.currentWindow = 0;
    this.flowControl.backpressure = false;
  }

  /**
   * Process messages continuously
   */
  private async processMessages(): Promise<void> {
    while (this.processing) {
      try {
        // Process batch
        const batch = await this.processBatch();
        if (batch) {
          // Add messages to processing queue
          this.processingQueue.push(...batch.messages);
          
          // Emit batch for processing
          this.emit('batchReady', { batch });
        }

        // Wait before next batch
        await this.delay(1000 / this.flowControl.flowRate);

      } catch (error) {
        this.emit('processingError', { error: error instanceof Error ? error.message : 'Unknown error' });
        await this.delay(1000); // Wait before retry
      }
    }
  }

  /**
   * Get queue for priority
   */
  private getQueue(priority: MessagePriority): Message[] {
    if (this.config.priorityQueues) {
      return this.queues.get(priority) || this.queues.get(MessagePriority.NORMAL)!;
    } else {
      return this.queues.get(MessagePriority.NORMAL)!;
    }
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update processing time statistics
   */
  private updateProcessingTime(processingTime: number): void {
    const totalTime = this.stats.averageProcessingTime * (this.stats.processed - 1) + processingTime;
    this.stats.averageProcessingTime = totalTime / this.stats.processed;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue statistics
   */
  public getStats(): QueueStats {
    return { ...this.stats };
  }

  /**
   * Get flow control status
   */
  public getFlowControl(): MessageFlowControl {
    return { ...this.flowControl };
  }

  /**
   * Update flow control settings
   */
  public updateFlowControl(flowControl: Partial<MessageFlowControl>): void {
    this.flowControl = { ...this.flowControl, ...flowControl };
    this.emit('flowControlUpdated', { flowControl: this.flowControl });
  }

  /**
   * Get dead letter queue
   */
  public getDeadLetterQueue(): DeadLetterMessage[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  public clearDeadLetterQueue(): void {
    this.deadLetterQueue = [];
    this.stats.deadLetter = 0;
    this.emit('deadLetterQueueCleared');
  }

  /**
   * Get processing queue
   */
  public getProcessingQueue(): Message[] {
    return [...this.processingQueue];
  }

  /**
   * Get queue sizes by priority
   */
  public getQueueSizes(): Record<MessagePriority, number> {
    const sizes: Record<MessagePriority, number> = {} as Record<MessagePriority, number>;
    
    for (const [priority, queue] of this.queues.entries()) {
      sizes[priority] = queue.length;
    }
    
    return sizes;
  }

  /**
   * Check if queue is empty
   */
  public isEmpty(): boolean {
    return this.stats.size === 0;
  }

  /**
   * Check if queue is full
   */
  public isFull(): boolean {
    return this.stats.size >= this.config.maxSize;
  }

  /**
   * Get queue capacity
   */
  public getCapacity(): number {
    return this.config.maxSize;
  }

  /**
   * Get queue utilization
   */
  public getUtilization(): number {
    return this.stats.size / this.config.maxSize;
  }

  /**
   * Update queue configuration
   */
  public updateConfig(config: Partial<QueueConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configUpdated', { config: this.config });
  }

  /**
   * Drain queue (remove all messages)
   */
  public drain(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
    this.processingQueue.length = 0;
    this.stats.size = 0;
    this.emit('queueDrained');
  }
} 