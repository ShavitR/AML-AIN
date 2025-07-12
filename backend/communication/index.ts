// Communication Layer - Main Export

// Types and Interfaces
export * from './types';

// Core Components
export { MessageSerializer } from './serializer';
export type { SerializationOptions, DeserializationOptions } from './serializer';
export { MessageRouter } from './router';
export type { RoutingTable, RoutingMetrics } from './router';
export { MessageValidator } from './validator';
export type { ValidationRule, ValidationContext } from './validator';
export { MessageQueue } from './queue';
export type { QueueConfig, QueueStats } from './queue';
export { CommunicationManager } from './manager';
export type { CommunicationConfig, CommunicationStats } from './manager'; 