import { Agent, AgentConfig, AgentState } from './agent-base';
import fs from 'fs';
import path from 'path';

// --- 1. Schema Validation ---
export function validateAgentConfig(config: AgentConfig): boolean {
  if (!config.id || typeof config.id !== 'string') return false;
  if (!config.name || typeof config.name !== 'string') return false;
  if (!config.type || typeof config.type !== 'string') return false;
  if (!Array.isArray(config.capabilities)) return false;
  return true;
}

// --- 2. Structured Logging ---
export interface AgentLogger {
  log(message: string, level?: 'info' | 'warn' | 'error', meta?: Record<string, any>): void;
}

export class ConsoleLogger implements AgentLogger {
  private json: boolean;
  constructor(json = false) { this.json = json; }
  log(message: string, level: 'info' | 'warn' | 'error' = 'info', meta: Record<string, any> = {}) {
    const logObj = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    if (this.json) {
      // Structured JSON log
      console[level](JSON.stringify(logObj));
    } else {
      // Human-readable log
      console[level](`[${logObj.timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
}

// --- 3. State Change Events ---
export type StateChangeCallback = (newState: AgentState, prevState: AgentState) => void;

// --- 4. Basic Metrics Interface ---
export interface AgentMetrics {
  [metric: string]: number;
}

// --- 5. CoreAgent with Upgrades ---
export abstract class CoreAgent extends Agent {
  protected logger: AgentLogger;
  protected version: string;
  protected stateChangeCallbacks: StateChangeCallback[] = [];
  protected metrics: AgentMetrics = {};

  constructor(config: AgentConfig, logger: AgentLogger = new ConsoleLogger()) {
    if (!validateAgentConfig(config)) {
      throw new Error('Invalid AgentConfig');
    }
    super(config);
    this.logger = logger;
    this.version = config.version || '1.0.0';
  }

  // --- Lifecycle ---
  async start(): Promise<void> {
    await this.initialize();
    this.logger.log('Agent started', 'info');
    this.transitionState('running');
  }

  async stop(): Promise<void> {
    this.logger.log('Agent stopping...', 'info');
    this.transitionState('stopped');
  }

  async restart(): Promise<void> {
    this.logger.log('Agent restarting...', 'info');
    await this.stop();
    await this.start();
  }

  override async shutdown(): Promise<void> {
    this.logger.log('Agent shutting down...', 'info');
    this.transitionState('stopped');
  }

  // --- State Management ---
  getState(): AgentState {
    return { ...this.state };
  }
  setState(newState: Partial<AgentState>): void {
    this.updateState(newState);
  }
  transitionState(status: AgentState['status']): void {
    const prevState = { ...this.state };
    this.state.status = status;
    this.state.lastSeen = new Date();
    this.logger.log(`State transitioned to ${status}`, 'info');
    this.stateChangeCallbacks.forEach(cb => cb({ ...this.state }, prevState));
  }
  onStateChange(cb: StateChangeCallback): void {
    this.stateChangeCallbacks.push(cb);
  }

  // --- Logging ---
  setLogger(logger: AgentLogger): void {
    this.logger = logger;
  }

  // --- Metrics ---
  override recordMetric(metric: string, value: number): void {
    this.metrics[metric] = value;
    this.logger.log(`Metric: ${metric} = ${value}`, 'info', { metric, value });
  }
  getMetrics(): AgentMetrics {
    return { ...this.metrics };
  }

  // --- Security Features (stub) ---
  checkSecurity(): boolean {
    this.logger.log('Security check (stub)', 'info');
    return true;
  }

  // --- Versioning ---
  getVersion(): string {
    return this.version;
  }

  // --- Validation (stub) ---
  validate(): boolean {
    this.logger.log('Validation (stub)', 'info');
    return true;
  }

  // --- Optimization (stub) ---
  optimize(): void {
    this.logger.log('Optimization (stub)', 'info');
  }

  // --- Documentation Generator (stub) ---
  generateDocs(): string {
    return `# Agent: ${this.config.name}\nType: ${this.config.type}\nVersion: ${this.version}`;
  }

  // --- Metadata Endpoint ---
  getMetadata(): Record<string, any> {
    return {
      id: this.config.id,
      name: this.config.name,
      type: this.config.type,
      version: this.version,
      capabilities: this.config.capabilities,
      status: this.state.status,
      health: this.state.health,
      lastSeen: this.state.lastSeen,
      metrics: this.getMetrics(),
    };
  }
}

// Base test harness for agents
export class AgentTestHarness {
  agent: CoreAgent;
  constructor(agent: CoreAgent) {
    this.agent = agent;
  }
  async runBasicLifecycleTest() {
    await this.agent.start();
    this.agent.recordMetric('test_metric', 42);
    await this.agent.restart();
    await this.agent.stop();
    await this.agent.shutdown();
    return this.agent.getState();
  }
}

// Export all relevant types
export * from './agent-base'; 