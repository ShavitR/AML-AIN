import { AgentRegistration, AgentDeployment, AgentRollback } from './types';
import { AgentDiscoveryService } from './discovery-service';

export type AgentLifecycleState = 
  | 'initializing'
  | 'registered'
  | 'deploying'
  | 'running'
  | 'scaling'
  | 'updating'
  | 'rolling_back'
  | 'stopping'
  | 'stopped'
  | 'failed'
  | 'deregistered';

export interface LifecycleTransition {
  from: AgentLifecycleState;
  to: AgentLifecycleState;
  timestamp: Date;
  reason: string;
  metadata?: Record<string, any>;
}

export interface LifecycleEvent {
  type: 'state_changed' | 'deployment_started' | 'deployment_completed' | 'rollback_started' | 'rollback_completed' | 'error';
  agentId: string;
  timestamp: Date;
  data: any;
}

export interface LifecycleConfig {
  maxRetries: number;
  retryDelay: number;
  healthCheckTimeout: number;
  deploymentTimeout: number;
  rollbackTimeout: number;
}

export class AgentLifecycleManager {
  private discoveryService: AgentDiscoveryService;
  private config: LifecycleConfig;
  private lifecycleStates: Map<string, AgentLifecycleState> = new Map();
  private transitions: Map<string, LifecycleTransition[]> = new Map();
  private deployments: Map<string, AgentDeployment> = new Map();
  private rollbacks: Map<string, AgentRollback> = new Map();
  private eventListeners: ((event: LifecycleEvent) => void)[] = [];

  constructor(discoveryService: AgentDiscoveryService, config: Partial<LifecycleConfig> = {}) {
    this.discoveryService = discoveryService;
    this.config = {
      maxRetries: 3,
      retryDelay: 5000,
      healthCheckTimeout: 30000,
      deploymentTimeout: 300000, // 5 minutes
      rollbackTimeout: 180000, // 3 minutes
      ...config
    };
  }

  /**
   * Initialize agent lifecycle
   */
  async initializeAgent(agentId: string): Promise<void> {
    this.setLifecycleState(agentId, 'initializing', 'Agent initialization started');
    
    try {
      // Perform initialization tasks
      await this.performInitialization(agentId);
      
      this.setLifecycleState(agentId, 'registered', 'Agent successfully registered');
      
      this.emitEvent({
        type: 'state_changed',
        agentId,
        timestamp: new Date(),
        data: { state: 'registered' }
      });
    } catch (error) {
      this.setLifecycleState(agentId, 'failed', `Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.emitEvent({
        type: 'error',
        agentId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Deploy an agent
   */
  async deployAgent(agentId: string, version: string, environment: 'development' | 'staging' | 'production' = 'development'): Promise<AgentDeployment> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState !== 'registered' && currentState !== 'stopped') {
      throw new Error(`Cannot deploy agent in state: ${currentState}`);
    }

    this.setLifecycleState(agentId, 'deploying', `Deployment started for version ${version}`);

    const deployment: AgentDeployment = {
      id: this.generateDeploymentId(agentId),
      agentId,
      version,
      environment,
      status: 'pending',
      instances: 1,
      resources: {
        cpu: '100m',
        memory: '128Mi',
        storage: '1Gi'
      },
      configuration: {},
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.deployments.set(deployment.id, deployment);

    this.emitEvent({
      type: 'deployment_started',
      agentId,
      timestamp: new Date(),
      data: { deployment }
    });

    try {
      // Perform deployment
      await this.performDeployment(deployment);
      
      deployment.status = 'running';
      deployment.updatedAt = new Date();
      
      this.setLifecycleState(agentId, 'running', `Deployment completed successfully`);
      
      this.emitEvent({
        type: 'deployment_completed',
        agentId,
        timestamp: new Date(),
        data: { deployment }
      });

      return deployment;
    } catch (error) {
      deployment.status = 'failed';
      deployment.updatedAt = new Date();
      
      this.setLifecycleState(agentId, 'failed', `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.emitEvent({
        type: 'error',
        agentId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error', deployment }
      });
      
      throw error;
    }
  }

  /**
   * Scale an agent
   */
  async scaleAgent(agentId: string, instances: number): Promise<void> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState !== 'running') {
      throw new Error(`Cannot scale agent in state: ${currentState}`);
    }

    this.setLifecycleState(agentId, 'scaling', `Scaling to ${instances} instances`);

    try {
      // Perform scaling
      await this.performScaling(agentId, instances);
      
      this.setLifecycleState(agentId, 'running', `Scaling completed successfully`);
    } catch (error) {
      this.setLifecycleState(agentId, 'failed', `Scaling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.emitEvent({
        type: 'error',
        agentId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Update an agent
   */
  async updateAgent(agentId: string, newVersion: string): Promise<AgentDeployment> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState !== 'running') {
      throw new Error(`Cannot update agent in state: ${currentState}`);
    }

    this.setLifecycleState(agentId, 'updating', `Updating to version ${newVersion}`);

    // Create new deployment
    const deployment = await this.deployAgent(agentId, newVersion);
    
    this.setLifecycleState(agentId, 'running', `Update completed successfully`);
    
    return deployment;
  }

  /**
   * Rollback an agent
   */
  async rollbackAgent(agentId: string, targetVersion: string, reason: string): Promise<AgentRollback> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState !== 'running' && currentState !== 'failed') {
      throw new Error(`Cannot rollback agent in state: ${currentState}`);
    }

    this.setLifecycleState(agentId, 'rolling_back', `Rolling back to version ${targetVersion}`);

    const rollback: AgentRollback = {
      id: this.generateRollbackId(agentId),
      deploymentId: this.getCurrentDeploymentId(agentId),
      fromVersion: this.getCurrentVersion(agentId),
      toVersion: targetVersion,
      reason,
      status: 'pending',
      createdAt: new Date()
    };

    this.rollbacks.set(rollback.id, rollback);

    this.emitEvent({
      type: 'rollback_started',
      agentId,
      timestamp: new Date(),
      data: { rollback }
    });

    try {
      // Perform rollback
      await this.performRollback(rollback);
      
      rollback.status = 'completed';
      rollback.completedAt = new Date();
      
      this.setLifecycleState(agentId, 'running', `Rollback completed successfully`);
      
      this.emitEvent({
        type: 'rollback_completed',
        agentId,
        timestamp: new Date(),
        data: { rollback }
      });

      return rollback;
    } catch (error) {
      rollback.status = 'failed';
      rollback.completedAt = new Date();
      
      this.setLifecycleState(agentId, 'failed', `Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.emitEvent({
        type: 'error',
        agentId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error', rollback }
      });
      
      throw error;
    }
  }

  /**
   * Stop an agent
   */
  async stopAgent(agentId: string): Promise<void> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState === 'stopped' || currentState === 'deregistered') {
      return;
    }

    this.setLifecycleState(agentId, 'stopping', 'Stopping agent');

    try {
      // Perform stop
      await this.performStop(agentId);
      
      this.setLifecycleState(agentId, 'stopped', 'Agent stopped successfully');
    } catch (error) {
      this.setLifecycleState(agentId, 'failed', `Stop failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      this.emitEvent({
        type: 'error',
        agentId,
        timestamp: new Date(),
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
      
      throw error;
    }
  }

  /**
   * Deregister an agent
   */
  async deregisterAgent(agentId: string): Promise<void> {
    const currentState = this.getLifecycleState(agentId);
    if (currentState === 'deregistered') {
      return;
    }

    // Stop agent first if running
    if (currentState === 'running') {
      await this.stopAgent(agentId);
    }

    this.setLifecycleState(agentId, 'deregistered', 'Agent deregistered');

    // Clean up lifecycle data
    this.lifecycleStates.delete(agentId);
    this.transitions.delete(agentId);
    
    // Clean up deployments
    for (const [deploymentId, deployment] of this.deployments.entries()) {
      if (deployment.agentId === agentId) {
        this.deployments.delete(deploymentId);
      }
    }
    
    // Clean up rollbacks
    for (const [rollbackId, rollback] of this.rollbacks.entries()) {
      if (rollback.deploymentId && this.deployments.get(rollback.deploymentId)?.agentId === agentId) {
        this.rollbacks.delete(rollbackId);
      }
    }
  }

  /**
   * Get current lifecycle state
   */
  getLifecycleState(agentId: string): AgentLifecycleState {
    return this.lifecycleStates.get(agentId) || 'initializing';
  }

  /**
   * Get lifecycle transitions
   */
  getLifecycleTransitions(agentId: string): LifecycleTransition[] {
    return this.transitions.get(agentId) || [];
  }

  /**
   * Get current deployment
   */
  getCurrentDeployment(agentId: string): AgentDeployment | null {
    for (const deployment of this.deployments.values()) {
      if (deployment.agentId === agentId && deployment.status === 'running') {
        return deployment;
      }
    }
    return null;
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): AgentDeployment | null {
    return this.deployments.get(deploymentId) || null;
  }

  /**
   * Get rollback by ID
   */
  getRollback(rollbackId: string): AgentRollback | null {
    return this.rollbacks.get(rollbackId) || null;
  }

  /**
   * Add event listener
   */
  onEvent(listener: (event: LifecycleEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  offEvent(listener: (event: LifecycleEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Set lifecycle state
   */
  private setLifecycleState(agentId: string, state: AgentLifecycleState, reason: string, metadata?: Record<string, any>): void {
    const previousState = this.lifecycleStates.get(agentId);
    
    if (previousState !== state) {
      this.lifecycleStates.set(agentId, state);
      
      const transition: LifecycleTransition = {
        from: previousState || 'initializing',
        to: state,
        timestamp: new Date(),
        reason,
        ...(metadata && { metadata })
      };

      if (!this.transitions.has(agentId)) {
        this.transitions.set(agentId, []);
      }
      this.transitions.get(agentId)!.push(transition);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emitEvent(event: LifecycleEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in lifecycle event listener:', error);
      }
    }
  }

  /**
   * Generate deployment ID
   */
  private generateDeploymentId(agentId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `deploy-${agentId}-${timestamp}-${random}`;
  }

  /**
   * Generate rollback ID
   */
  private generateRollbackId(agentId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `rollback-${agentId}-${timestamp}-${random}`;
  }

  /**
   * Get current deployment ID
   */
  private getCurrentDeploymentId(agentId: string): string {
    const deployment = this.getCurrentDeployment(agentId);
    return deployment?.id || '';
  }

  /**
   * Get current version
   */
  private getCurrentVersion(agentId: string): string {
    const deployment = this.getCurrentDeployment(agentId);
    return deployment?.version || '';
  }

  /**
   * Perform initialization tasks
   */
  private async performInitialization(agentId: string): Promise<void> {
    // Simulate initialization tasks
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Perform deployment
   */
  private async performDeployment(deployment: AgentDeployment): Promise<void> {
    // Simulate deployment process
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Perform scaling
   */
  private async performScaling(agentId: string, instances: number): Promise<void> {
    // Simulate scaling process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  /**
   * Perform rollback
   */
  private async performRollback(rollback: AgentRollback): Promise<void> {
    // Simulate rollback process
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  /**
   * Perform stop
   */
  private async performStop(agentId: string): Promise<void> {
    // Simulate stop process
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
} 