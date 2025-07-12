// Types and interfaces
export * from './types';

// Registration protocol
export * from './registration-protocol';

// Discovery service
export { AgentDiscoveryService } from './discovery-service';
export type { DiscoveryResult } from './discovery-service';

// Health checking system
export * from './health-checker';

// Capability registry
export { CapabilityRegistry } from './capability-registry';
export type { 
  CapabilityMetadata, 
  CapabilityVersion,
  CapabilitySearchQuery,
  CapabilitySearchResult 
} from './capability-registry';

// Lifecycle management
export * from './lifecycle-manager'; 