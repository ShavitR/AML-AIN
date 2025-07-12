export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  tags: string[];
  parameters: Record<string, any>;
  returnType: string;
  examples: string[];
}

export interface AgentMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  repository: string;
  documentation: string;
  tags: string[];
  capabilities: AgentCapability[];
  dependencies: string[];
  requirements: {
    cpu: string;
    memory: string;
    gpu?: string;
    storage: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentHealth {
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastHeartbeat: Date;
  responseTime: number;
  errorCount: number;
  uptime: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    disk: number;
    network: number;
  };
  customMetrics: Record<string, any>;
}

export interface AgentRegistration {
  id: string;
  metadata: AgentMetadata;
  health: AgentHealth;
  endpoint: string;
  protocol: 'http' | 'https' | 'grpc' | 'websocket';
  authentication: {
    type: 'none' | 'api_key' | 'jwt' | 'oauth';
    credentials?: Record<string, any>;
  };
  loadBalancing: {
    weight: number;
    maxConnections: number;
    timeout: number;
  };
  isolation: {
    namespace: string;
    resourceLimits: Record<string, any>;
    securityContext: Record<string, any>;
  };
  scaling: {
    minInstances: number;
    maxInstances: number;
    targetCPUUtilization: number;
    targetMemoryUtilization: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDiscoveryQuery {
  capabilities?: string[];
  tags?: string[];
  category?: string;
  version?: string;
  status?: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  namespace?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'version' | 'createdAt' | 'updatedAt' | 'responseTime';
  sortOrder?: 'asc' | 'desc';
}

export interface AgentConflict {
  id: string;
  type: 'version' | 'capability' | 'endpoint' | 'namespace';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedAgents: string[];
  resolution?: string;
  createdAt: Date;
}

export interface AgentDeployment {
  id: string;
  agentId: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  status: 'pending' | 'deploying' | 'running' | 'failed' | 'stopped';
  instances: number;
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
  configuration: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRollback {
  id: string;
  deploymentId: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  createdAt: Date;
  completedAt?: Date;
}

export interface AgentScalingPolicy {
  id: string;
  agentId: string;
  type: 'cpu' | 'memory' | 'custom';
  threshold: number;
  action: 'scale_up' | 'scale_down';
  minInstances: number;
  maxInstances: number;
  cooldownPeriod: number;
  enabled: boolean;
  createdAt: Date;
}

export interface AgentResourceAllocation {
  id: string;
  agentId: string;
  cpu: {
    request: string;
    limit: string;
    current: number;
  };
  memory: {
    request: string;
    limit: string;
    current: number;
  };
  storage: {
    request: string;
    limit: string;
    current: number;
  };
  gpu?: {
    request: string;
    limit: string;
    current: number;
  };
  network: {
    bandwidth: string;
    current: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentIsolationConfig {
  id: string;
  agentId: string;
  namespace: string;
  resourceQuotas: Record<string, any>;
  securityContext: {
    runAsUser: number;
    runAsGroup: number;
    fsGroup: number;
    capabilities: string[];
  };
  networkPolicy: {
    ingress: any[];
    egress: any[];
  };
  volumeMounts: Array<{
    name: string;
    mountPath: string;
    readOnly: boolean;
  }>;
  environmentVariables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentMonitoringConfig {
  id: string;
  agentId: string;
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
    retention: number;
  };
  alerting: {
    enabled: boolean;
    rules: Array<{
      name: string;
      condition: string;
      threshold: number;
      duration: number;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };
  tracing: {
    enabled: boolean;
    sampler: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentDashboardData {
  totalAgents: number;
  healthyAgents: number;
  unhealthyAgents: number;
  degradedAgents: number;
  agentsByCategory: Record<string, number>;
  agentsByNamespace: Record<string, number>;
  recentRegistrations: AgentRegistration[];
  recentDeployments: AgentDeployment[];
  activeConflicts: AgentConflict[];
  resourceUtilization: {
    cpu: number;
    memory: number;
    storage: number;
    network: number;
  };
  performanceMetrics: {
    averageResponseTime: number;
    totalRequests: number;
    errorRate: number;
  };
} 