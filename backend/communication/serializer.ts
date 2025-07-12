// Message Serialization and Deserialization System

import { Message, MessageType, MessagePriority } from './types';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export interface SerializationOptions {
  format: 'json' | 'msgpack' | 'protobuf' | 'avro';
  compression?: boolean;
  encryption?: boolean;
  includeMetadata?: boolean;
  validateSchema?: boolean;
}

export interface DeserializationOptions {
  format: 'json' | 'msgpack' | 'protobuf' | 'avro';
  decompress?: boolean;
  decrypt?: boolean;
  validateSchema?: boolean;
  strict?: boolean;
}

export class MessageSerializer {
  private static instance: MessageSerializer;
  private supportedFormats: Set<string>;

  private constructor() {
    this.supportedFormats = new Set(['json', 'msgpack']);
  }

  public static getInstance(): MessageSerializer {
    if (!MessageSerializer.instance) {
      MessageSerializer.instance = new MessageSerializer();
    }
    return MessageSerializer.instance;
  }

  /**
   * Serialize a message to the specified format
   */
  public serialize(message: Message, options: SerializationOptions): Buffer {
    try {
      // Validate message before serialization
      this.validateMessage(message);

      let serialized: Buffer;

      switch (options.format) {
        case 'json':
          serialized = this.serializeToJson(message, options);
          break;
        case 'msgpack':
          serialized = this.serializeToMsgPack(message, options);
          break;
        default:
          throw new Error(`Unsupported serialization format: ${options.format}`);
      }

      // Add compression if requested
      if (options.compression && serialized.length > 1024) {
        serialized = this.compress(serialized);
      }

      // Add encryption if requested
      if (options.encryption) {
        serialized = this.encrypt(serialized);
      }

      return serialized;
    } catch (error) {
      throw new Error(`Serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Deserialize a message from the specified format
   */
  public deserialize(data: Buffer, options: DeserializationOptions): Message {
    try {
      let deserialized: Buffer = data;

      // Decrypt if needed
      if (options.decrypt) {
        deserialized = this.decrypt(deserialized);
      }

      // Decompress if needed
      if (options.decompress) {
        deserialized = this.decompress(deserialized);
      }

      let message: Message;

      switch (options.format) {
        case 'json':
          message = this.deserializeFromJson(deserialized, options);
          break;
        case 'msgpack':
          message = this.deserializeFromMsgPack(deserialized, options);
          break;
        default:
          throw new Error(`Unsupported deserialization format: ${options.format}`);
      }

      // Validate message after deserialization
      if (options.validateSchema) {
        this.validateMessage(message);
      }

      return message;
    } catch (error) {
      throw new Error(`Deserialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new message with proper defaults
   */
  public createMessage(
    type: MessageType,
    sender: string,
    recipient: string | string[],
    payload: any,
    options: Partial<Message> = {}
  ): Message {
    const message: Message = {
      id: uuidv4(),
      type,
      sender,
      recipient,
      timestamp: Date.now(),
      payload,
      metadata: {
        compression: false,
        encryption: false,
        retryCount: 0,
        maxRetries: 3,
        timeout: 30000,
        tags: [],
        ...options.metadata
      },
      priority: options.priority || MessagePriority.NORMAL,
      version: '1.0.0',
      ...options
    };

    // Set optional fields only if they exist
    if (options.correlationId) message.correlationId = options.correlationId;
    if (options.parentId) message.parentId = options.parentId;
    if (options.expiresAt) message.expiresAt = options.expiresAt;

    // Generate correlation ID if not provided
    if (!message.correlationId) {
      message.correlationId = this.generateCorrelationId(message);
    }

    return message;
  }

  /**
   * Validate message structure and content
   */
  private validateMessage(message: Message): void {
    const errors: string[] = [];

    // Required fields
    if (!message.id) errors.push('Message ID is required');
    if (!message.type) errors.push('Message type is required');
    if (!message.sender) errors.push('Message sender is required');
    if (!message.recipient) errors.push('Message recipient is required');
    if (message.timestamp === undefined) errors.push('Message timestamp is required');
    if (!message.payload) errors.push('Message payload is required');
    if (!message.metadata) errors.push('Message metadata is required');
    if (!message.priority) errors.push('Message priority is required');
    if (!message.version) errors.push('Message version is required');

    // Type validation
    if (typeof message.id !== 'string') errors.push('Message ID must be a string');
    if (typeof message.sender !== 'string') errors.push('Message sender must be a string');
    if (typeof message.timestamp !== 'number') errors.push('Message timestamp must be a number');
    if (typeof message.priority !== 'number') errors.push('Message priority must be a number');
    if (typeof message.version !== 'string') errors.push('Message version must be a string');

    // Recipient validation
    if (Array.isArray(message.recipient)) {
      if (message.recipient.length === 0) errors.push('Message recipient array cannot be empty');
      if (!message.recipient.every(r => typeof r === 'string')) {
        errors.push('All recipients must be strings');
      }
    } else if (typeof message.recipient !== 'string') {
      errors.push('Message recipient must be a string or array of strings');
    }

    // Priority validation
    if (message.priority < 1 || message.priority > 5) {
      errors.push('Message priority must be between 1 and 5');
    }

    // Expiration validation
    if (message.expiresAt && message.expiresAt <= message.timestamp) {
      errors.push('Message expiration must be after timestamp');
    }

    if (errors.length > 0) {
      throw new Error(`Message validation failed: ${errors.join(', ')}`);
    }
  }

  /**
   * Serialize to JSON format
   */
  private serializeToJson(message: Message, options: SerializationOptions): Buffer {
    const serialized = JSON.stringify(message, null, options.includeMetadata ? 2 : 0);
    return Buffer.from(serialized, 'utf8');
  }

  /**
   * Deserialize from JSON format
   */
  private deserializeFromJson(data: Buffer, options: DeserializationOptions): Message {
    const jsonString = data.toString('utf8');
    const message = JSON.parse(jsonString);

    if (options.strict) {
      this.validateMessage(message);
    }

    return message;
  }

  /**
   * Serialize to MessagePack format (placeholder - would need msgpack library)
   */
  private serializeToMsgPack(message: Message, options: SerializationOptions): Buffer {
    // For now, fall back to JSON. In production, use a proper MessagePack library
    return this.serializeToJson(message, options);
  }

  /**
   * Deserialize from MessagePack format (placeholder - would need msgpack library)
   */
  private deserializeFromMsgPack(data: Buffer, options: DeserializationOptions): Message {
    // For now, fall back to JSON. In production, use a proper MessagePack library
    return this.deserializeFromJson(data, options);
  }

  /**
   * Compress data using gzip
   */
  private compress(data: Buffer): Buffer {
    const zlib = require('zlib');
    return zlib.gzipSync(data);
  }

  /**
   * Decompress data using gzip
   */
  private decompress(data: Buffer): Buffer {
    const zlib = require('zlib');
    return zlib.gunzipSync(data);
  }

  /**
   * Encrypt data (placeholder - would need proper encryption library)
   */
  private encrypt(data: Buffer): Buffer {
    // For now, return as-is. In production, use proper encryption
    return data;
  }

  /**
   * Decrypt data (placeholder - would need proper encryption library)
   */
  private decrypt(data: Buffer): Buffer {
    // For now, return as-is. In production, use proper decryption
    return data;
  }

  /**
   * Generate correlation ID based on message content
   */
  private generateCorrelationId(message: Message): string {
    const content = `${message.sender}-${message.recipient}-${message.type}-${message.timestamp}`;
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Get supported serialization formats
   */
  public getSupportedFormats(): string[] {
    return Array.from(this.supportedFormats);
  }

  /**
   * Check if format is supported
   */
  public isFormatSupported(format: string): boolean {
    return this.supportedFormats.has(format);
  }
} 