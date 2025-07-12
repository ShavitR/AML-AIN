import { AgentRegistration, AgentMetadata, AgentHealth } from './types';

export interface RegistrationRequest {
  metadata: AgentMetadata;
  endpoint: string;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  authentication?: {
    type: 'none' | 'api_key' | 'jwt' | 'oauth';
    credentials?: Record<string, any>;
  };
  loadBalancing?: {
    weight?: number;
    maxConnections?: number;
    timeout?: number;
  };
  isolation?: {
    namespace?: string;
    resourceLimits?: Record<string, any>;
    securityContext?: Record<string, any>;
  };
  scaling?: {
    minInstances?: number;
    maxInstances?: number;
    targetCPUUtilization?: number;
    targetMemoryUtilization?: number;
  };
}

export interface RegistrationResponse {
  success: boolean;
  agentId: string;
  message: string;
  conflicts?: string[];
  warnings?: string[];
  nextHeartbeatInterval: number;
}

export interface DeregistrationRequest {
  agentId: string;
  reason?: string;
}

export interface DeregistrationResponse {
  success: boolean;
  message: string;
}

export interface HeartbeatRequest {
  agentId: string;
  health: AgentHealth;
  timestamp: Date;
}

export interface HeartbeatResponse {
  success: boolean;
  message: string;
  nextHeartbeatInterval: number;
  actions?: string[];
}

export class RegistrationProtocol {
  private static readonly DEFAULT_LOAD_BALANCING = {
    weight: 1,
    maxConnections: 100,
    timeout: 30000
  };

  private static readonly DEFAULT_ISOLATION = {
    namespace: 'default',
    resourceLimits: {},
    securityContext: {}
  };

  private static readonly DEFAULT_SCALING = {
    minInstances: 1,
    maxInstances: 10,
    targetCPUUtilization: 70,
    targetMemoryUtilization: 80
  };

  /**
   * Validates a registration request
   */
  static validateRegistrationRequest(request: RegistrationRequest): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate metadata
    if (!request.metadata) {
      errors.push('Metadata is required');
    } else {
      if (!request.metadata.id || request.metadata.id.trim() === '') {
        errors.push('Agent ID is required');
      }
      if (!request.metadata.name || request.metadata.name.trim() === '') {
        errors.push('Agent name is required');
      }
      if (!request.metadata.version || request.metadata.version.trim() === '') {
        errors.push('Agent version is required');
      }
      if (!request.metadata.author || request.metadata.author.trim() === '') {
        errors.push('Agent author is required');
      }
      if (!request.metadata.capabilities || request.metadata.capabilities.length === 0) {
        errors.push('At least one capability is required');
      }
    }

    // Validate endpoint
    if (!request.endpoint || request.endpoint.trim() === '') {
      errors.push('Endpoint is required');
    } else {
      try {
        new URL(request.endpoint);
      } catch {
        errors.push('Invalid endpoint URL format');
      }
    }

    // Validate protocol
    if (!request.protocol || !['http', 'https', 'grpc', 'websocket'].includes(request.protocol)) {
      errors.push('Valid protocol is required (http, https, grpc, websocket)');
    }

    // Validate authentication
    if (request.authentication) {
      if (!['none', 'api_key', 'jwt', 'oauth'].includes(request.authentication.type)) {
        errors.push('Invalid authentication type');
      }
      if (request.authentication.type !== 'none' && !request.authentication.credentials) {
        errors.push('Credentials are required for non-none authentication types');
      }
    }

    // Validate load balancing
    if (request.loadBalancing) {
      if (request.loadBalancing.weight !== undefined && (request.loadBalancing.weight < 0 || request.loadBalancing.weight > 100)) {
        errors.push('Load balancing weight must be between 0 and 100');
      }
      if (request.loadBalancing.maxConnections !== undefined && request.loadBalancing.maxConnections <= 0) {
        errors.push('Max connections must be greater than 0');
      }
      if (request.loadBalancing.timeout !== undefined && request.loadBalancing.timeout <= 0) {
        errors.push('Timeout must be greater than 0');
      }
    }

    // Validate scaling
    if (request.scaling) {
      if (request.scaling.minInstances !== undefined && request.scaling.minInstances < 0) {
        errors.push('Min instances must be non-negative');
      }
      if (request.scaling.maxInstances !== undefined && request.scaling.maxInstances <= 0) {
        errors.push('Max instances must be greater than 0');
      }
      if (request.scaling.minInstances !== undefined && request.scaling.maxInstances !== undefined && 
          request.scaling.minInstances > request.scaling.maxInstances) {
        errors.push('Min instances cannot be greater than max instances');
      }
      if (request.scaling.targetCPUUtilization !== undefined && 
          (request.scaling.targetCPUUtilization < 0 || request.scaling.targetCPUUtilization > 100)) {
        errors.push('Target CPU utilization must be between 0 and 100');
      }
      if (request.scaling.targetMemoryUtilization !== undefined && 
          (request.scaling.targetMemoryUtilization < 0 || request.scaling.targetMemoryUtilization > 100)) {
        errors.push('Target memory utilization must be between 0 and 100');
      }
    }

    // Warnings
    if (!request.authentication || request.authentication.type === 'none') {
      warnings.push('No authentication configured - agent will be accessible without authentication');
    }
    if (!request.isolation || !request.isolation.namespace || request.isolation.namespace === 'default') {
      warnings.push('Agent will run in default namespace - consider using a dedicated namespace for isolation');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Creates a complete agent registration from a request
   */
  static createAgentRegistration(request: RegistrationRequest): AgentRegistration {
    const now = new Date();
    
    return {
      id: request.metadata.id,
      metadata: {
        ...request.metadata,
        createdAt: now,
        updatedAt: now
      },
      health: {
        status: 'unknown',
        lastHeartbeat: now,
        responseTime: 0,
        errorCount: 0,
        uptime: 0,
        resourceUsage: {
          cpu: 0,
          memory: 0,
          disk: 0,
          network: 0
        },
        customMetrics: {}
      },
      endpoint: request.endpoint,
      protocol: request.protocol,
      authentication: request.authentication || { type: 'none' },
      loadBalancing: {
        ...this.DEFAULT_LOAD_BALANCING,
        ...request.loadBalancing
      },
      isolation: {
        ...this.DEFAULT_ISOLATION,
        ...request.isolation
      },
      scaling: {
        ...this.DEFAULT_SCALING,
        ...request.scaling
      },
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Validates a heartbeat request
   */
  static validateHeartbeatRequest(request: HeartbeatRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.agentId || request.agentId.trim() === '') {
      errors.push('Agent ID is required');
    }
    if (!request.health) {
      errors.push('Health data is required');
    } else {
      if (!['healthy', 'unhealthy', 'degraded', 'unknown'].includes(request.health.status)) {
        errors.push('Invalid health status');
      }
      if (!request.health.lastHeartbeat) {
        errors.push('Last heartbeat timestamp is required');
      }
      if (request.health.responseTime < 0) {
        errors.push('Response time cannot be negative');
      }
      if (request.health.errorCount < 0) {
        errors.push('Error count cannot be negative');
      }
      if (request.health.uptime < 0) {
        errors.push('Uptime cannot be negative');
      }
    }
    if (!request.timestamp) {
      errors.push('Timestamp is required');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates a deregistration request
   */
  static validateDeregistrationRequest(request: DeregistrationRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!request.agentId || request.agentId.trim() === '') {
      errors.push('Agent ID is required');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Generates a unique agent ID
   */
  static generateAgentId(prefix: string = 'agent'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  /**
   * Calculates the next heartbeat interval based on agent health
   */
  static calculateHeartbeatInterval(health: AgentHealth, baseInterval: number = 30000): number {
    let interval = baseInterval;

    // Adjust based on health status
    switch (health.status) {
      case 'healthy':
        interval = baseInterval;
        break;
      case 'degraded':
        interval = baseInterval * 0.5; // More frequent heartbeats
        break;
      case 'unhealthy':
        interval = baseInterval * 0.25; // Very frequent heartbeats
        break;
      case 'unknown':
        interval = baseInterval * 0.5;
        break;
    }

    // Adjust based on error count
    if (health.errorCount > 10) {
      interval = Math.max(interval * 0.5, 5000); // Minimum 5 seconds
    }

    // Adjust based on response time
    if (health.responseTime > 1000) {
      interval = Math.max(interval * 1.5, baseInterval);
    }

    return Math.round(interval);
  }
} 