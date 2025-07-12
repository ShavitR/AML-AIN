// Message Validation and Schema Checking System

import { Message, MessageType, MessageSchema, MessageValidationResult } from './types';

export interface ValidationRule {
  id: string;
  name: string;
  field: string;
  type: 'required' | 'type' | 'format' | 'range' | 'length' | 'pattern' | 'custom';
  value?: any;
  message: string;
  enabled: boolean;
}

export interface ValidationContext {
  message: Message;
  rules: ValidationRule[];
  schemas: Record<string, MessageSchema>;
  customValidators: Record<string, (value: any) => boolean>;
}

export class MessageValidator {
  private static instance: MessageValidator;
  private schemas: Map<string, MessageSchema> = new Map();
  private rules: ValidationRule[] = [];
  private customValidators: Map<string, (value: any) => boolean> = new Map();

  private constructor() {
    this.initializeDefaultSchemas();
    this.initializeDefaultRules();
  }

  public static getInstance(): MessageValidator {
    if (!MessageValidator.instance) {
      MessageValidator.instance = new MessageValidator();
    }
    return MessageValidator.instance;
  }

  /**
   * Validate a message against schemas and rules
   */
  public validateMessage(message: Message): MessageValidationResult {
    const result: MessageValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      // Basic structure validation
      this.validateBasicStructure(message, result);

      // Schema validation
      this.validateSchema(message, result);

      // Custom rules validation
      this.validateCustomRules(message, result);

      // Business logic validation
      this.validateBusinessLogic(message, result);

      // Update result validity
      result.valid = result.errors.length === 0;

    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Validate basic message structure
   */
  private validateBasicStructure(message: Message, result: MessageValidationResult): void {
    // Required fields
    if (!message.id) {
      result.errors.push('Message ID is required');
    }
    if (!message.type) {
      result.errors.push('Message type is required');
    }
    if (!message.sender) {
      result.errors.push('Message sender is required');
    }
    if (!message.recipient) {
      result.errors.push('Message recipient is required');
    }
    if (message.timestamp === undefined) {
      result.errors.push('Message timestamp is required');
    }
    if (!message.payload) {
      result.errors.push('Message payload is required');
    }
    if (!message.metadata) {
      result.errors.push('Message metadata is required');
    }
    if (!message.priority) {
      result.errors.push('Message priority is required');
    }
    if (!message.version) {
      result.errors.push('Message version is required');
    }

    // Type validation
    if (message.id && typeof message.id !== 'string') {
      result.errors.push('Message ID must be a string');
    }
    if (message.sender && typeof message.sender !== 'string') {
      result.errors.push('Message sender must be a string');
    }
    if (message.timestamp !== undefined && typeof message.timestamp !== 'number') {
      result.errors.push('Message timestamp must be a number');
    }
    if (message.priority && typeof message.priority !== 'number') {
      result.errors.push('Message priority must be a number');
    }
    if (message.version && typeof message.version !== 'string') {
      result.errors.push('Message version must be a string');
    }

    // Recipient validation
    if (message.recipient) {
      if (Array.isArray(message.recipient)) {
        if (message.recipient.length === 0) {
          result.errors.push('Message recipient array cannot be empty');
        }
        if (!message.recipient.every(r => typeof r === 'string')) {
          result.errors.push('All recipients must be strings');
        }
      } else if (typeof message.recipient !== 'string') {
        result.errors.push('Message recipient must be a string or array of strings');
      }
    }

    // Priority validation
    if (message.priority && (message.priority < 1 || message.priority > 5)) {
      result.errors.push('Message priority must be between 1 and 5');
    }

    // Expiration validation
    if (message.expiresAt && message.timestamp && message.expiresAt <= message.timestamp) {
      result.errors.push('Message expiration must be after timestamp');
    }
  }

  /**
   * Validate message against schema
   */
  private validateSchema(message: Message, result: MessageValidationResult): void {
    const schema = this.schemas.get(message.type);
    if (!schema) {
      result.warnings.push(`No schema found for message type: ${message.type}`);
      return;
    }

    // Validate required fields
    for (const requiredField of schema.required) {
      const value = this.getFieldValue(message, requiredField);
      if (value === undefined || value === null) {
        result.errors.push(`Required field '${requiredField}' is missing`);
      }
    }

    // Validate properties
    for (const [field, fieldSchema] of Object.entries(schema.properties)) {
      const value = this.getFieldValue(message, field);
      if (value !== undefined && value !== null) {
        this.validateField(value, fieldSchema, field, result);
      }
    }

    // Check for additional properties
    if (!schema.additionalProperties) {
      const messageKeys = this.getAllKeys(message);
      const schemaKeys = new Set([...schema.required, ...Object.keys(schema.properties)]);
      
      for (const key of messageKeys) {
        if (!schemaKeys.has(key)) {
          result.warnings.push(`Additional property '${key}' is not allowed by schema`);
        }
      }
    }
  }

  /**
   * Validate custom rules
   */
  private validateCustomRules(message: Message, result: MessageValidationResult): void {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const value = this.getFieldValue(message, rule.field);
      
      switch (rule.type) {
        case 'required':
          if (value === undefined || value === null) {
            result.errors.push(rule.message);
          }
          break;
        case 'type':
          if (value !== undefined && typeof value !== rule.value) {
            result.errors.push(rule.message);
          }
          break;
        case 'format':
          if (value !== undefined && !this.validateFormat(value, rule.value)) {
            result.errors.push(rule.message);
          }
          break;
        case 'range':
          if (value !== undefined && typeof value === 'number') {
            const { min, max } = rule.value;
            if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
              result.errors.push(rule.message);
            }
          }
          break;
        case 'length':
          if (value !== undefined && typeof value === 'string') {
            const { min, max } = rule.value;
            if ((min !== undefined && value.length < min) || (max !== undefined && value.length > max)) {
              result.errors.push(rule.message);
            }
          }
          break;
        case 'pattern':
          if (value !== undefined && typeof value === 'string') {
            const regex = new RegExp(rule.value);
            if (!regex.test(value)) {
              result.errors.push(rule.message);
            }
          }
          break;
        case 'custom':
          if (value !== undefined) {
            const validator = this.customValidators.get(rule.value);
            if (validator && !validator(value)) {
              result.errors.push(rule.message);
            }
          }
          break;
      }
    }
  }

  /**
   * Validate business logic
   */
  private validateBusinessLogic(message: Message, result: MessageValidationResult): void {
    // Check for expired messages
    if (message.expiresAt && message.expiresAt < Date.now()) {
      result.warnings.push('Message has expired');
    }

    // Check for routing loops
    if (message.metadata.routing && message.metadata.routing.hops > message.metadata.routing.maxHops) {
      result.errors.push('Maximum hop count exceeded');
    }

    // Check for invalid message types
    if (!Object.values(MessageType).includes(message.type)) {
      result.warnings.push(`Unknown message type: ${message.type}`);
    }

    // Check for self-sending messages
    if (Array.isArray(message.recipient) && message.recipient.includes(message.sender)) {
      result.warnings.push('Message sender is also a recipient');
    } else if (message.recipient === message.sender) {
      result.warnings.push('Message sender is also the recipient');
    }
  }

  /**
   * Validate field value against schema
   */
  private validateField(value: any, schema: any, field: string, result: MessageValidationResult): void {
    // Type validation
    if (schema.type && typeof value !== schema.type) {
      result.errors.push(`Field '${field}' must be of type ${schema.type}`);
      return;
    }

    // Format validation
    if (schema.format && !this.validateFormat(value, schema.format)) {
      result.errors.push(`Field '${field}' has invalid format: ${schema.format}`);
    }

    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      result.errors.push(`Field '${field}' must be one of: ${schema.enum.join(', ')}`);
    }

    // Range validation
    if (schema.minimum !== undefined && value < schema.minimum) {
      result.errors.push(`Field '${field}' must be at least ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      result.errors.push(`Field '${field}' must be at most ${schema.maximum}`);
    }

    // Length validation
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        result.errors.push(`Field '${field}' must be at least ${schema.minLength} characters`);
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        result.errors.push(`Field '${field}' must be at most ${schema.maxLength} characters`);
      }
    }

    // Pattern validation
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        result.errors.push(`Field '${field}' must match pattern: ${schema.pattern}`);
      }
    }
  }

  /**
   * Validate format
   */
  private validateFormat(value: any, format: string): boolean {
    switch (format) {
      case 'uuid':
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'uri':
        try {
          new URL(value);
          return true;
        } catch {
          return false;
        }
      case 'date-time':
        return !isNaN(Date.parse(value));
      case 'ipv4':
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(value);
      case 'ipv6':
        return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value);
      default:
        return true;
    }
  }

  /**
   * Get field value using dot notation
   */
  private getFieldValue(obj: any, field: string): any {
    const parts = field.split('.');
    let value: any = obj;

    for (const part of parts) {
      if (value && typeof value === 'object' && part && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get all keys from an object (including nested)
   */
  private getAllKeys(obj: any, prefix = ''): string[] {
    const keys: string[] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.push(fullKey);
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        keys.push(...this.getAllKeys(value, fullKey));
      }
    }
    
    return keys;
  }

  /**
   * Add a schema
   */
  public addSchema(type: string, schema: MessageSchema): void {
    this.schemas.set(type, schema);
  }

  /**
   * Remove a schema
   */
  public removeSchema(type: string): void {
    this.schemas.delete(type);
  }

  /**
   * Add a validation rule
   */
  public addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule
   */
  public removeRule(ruleId: string): void {
    const index = this.rules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
    }
  }

  /**
   * Add a custom validator
   */
  public addCustomValidator(name: string, validator: (value: any) => boolean): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Remove a custom validator
   */
  public removeCustomValidator(name: string): void {
    this.customValidators.delete(name);
  }

  /**
   * Initialize default schemas
   */
  private initializeDefaultSchemas(): void {
    // Basic message schema
    this.addSchema('base', {
      type: 'object',
      required: ['id', 'type', 'sender', 'recipient', 'timestamp', 'payload', 'metadata', 'priority', 'version'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: { type: 'string' },
        sender: { type: 'string' },
        recipient: { type: 'string' },
        timestamp: { type: 'number' },
        payload: { type: 'object' },
        metadata: { type: 'object' },
        priority: { type: 'number', minimum: 1, maximum: 5 },
        version: { type: 'string' }
      },
      additionalProperties: false
    });

    // Task request schema
    this.addSchema(MessageType.TASK_REQUEST, {
      type: 'object',
      required: ['id', 'type', 'sender', 'recipient', 'timestamp', 'payload', 'metadata', 'priority', 'version'],
      properties: {
        id: { type: 'string', format: 'uuid' },
        type: { type: 'string', enum: [MessageType.TASK_REQUEST] },
        sender: { type: 'string' },
        recipient: { type: 'string' },
        timestamp: { type: 'number' },
        payload: {
          type: 'object',
          required: ['taskId', 'taskType', 'parameters'],
          properties: {
            taskId: { type: 'string' },
            taskType: { type: 'string' },
            parameters: { type: 'object' },
            priority: { type: 'number' },
            timeout: { type: 'number' }
          }
        },
        metadata: { type: 'object' },
        priority: { type: 'number', minimum: 1, maximum: 5 },
        version: { type: 'string' }
      },
      additionalProperties: false
    });
  }

  /**
   * Initialize default rules
   */
  private initializeDefaultRules(): void {
    // Add some basic validation rules
    this.addRule({
      id: 'uuid-format',
      name: 'UUID Format Validation',
      field: 'id',
      type: 'pattern',
      value: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
      message: 'Message ID must be a valid UUID',
      enabled: true
    });

    this.addRule({
      id: 'timestamp-range',
      name: 'Timestamp Range Validation',
      field: 'timestamp',
      type: 'range',
      value: { min: 0, max: Date.now() + 86400000 }, // Allow 24 hours in future
      message: 'Message timestamp must be within valid range',
      enabled: true
    });
  }
} 