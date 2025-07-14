// Core interfaces for agent configuration and state
export interface AgentConfig {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  version?: string;
  [key: string]: any;
}

export interface AgentState {
  status: 'initializing' | 'running' | 'stopped' | 'error';
  health: 'healthy' | 'unhealthy';
  lastSeen: Date;
  error?: string;
  [key: string]: any;
}

// Base Agent class
export abstract class Agent {
  public config: AgentConfig;
  public state: AgentState;

  constructor(config: AgentConfig) {
    this.config = config;
    this.state = {
      status: 'initializing',
      health: 'healthy',
      lastSeen: new Date(),
    };
    this.log('Agent created', 'info');
  }

  // --- Lifecycle Hooks ---
  async initialize(): Promise<void> {
    this.log('Initializing agent...', 'info');
    this.state.status = 'running';
    this.state.lastSeen = new Date();
  }

  async shutdown(): Promise<void> {
    this.log('Shutting down agent...', 'info');
    this.state.status = 'stopped';
    this.state.lastSeen = new Date();
  }

  async onError(error: Error): Promise<void> {
    this.state.status = 'error';
    this.state.health = 'unhealthy';
    this.state.error = error.message;
    this.log(`Error: ${error.message}`, 'error');
  }

  // --- State Management ---
  updateState(partial: Partial<AgentState>): void {
    this.state = { ...this.state, ...partial, lastSeen: new Date() };
  }

  // --- Logging ---
  log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    // Stub: Replace with real logging
    console[level](`[${this.config.name}] ${message}`);
  }

  // --- Performance Monitoring (stub) ---
  recordMetric(metric: string, value: number): void {
    // Stub: Implement real metrics
    this.log(`Metric: ${metric} = ${value}`, 'info');
  }

  // --- Abstract methods for agent-specific logic ---
  abstract handleMessage(message: any): Promise<void>;
} 