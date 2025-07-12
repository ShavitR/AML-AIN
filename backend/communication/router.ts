// Message Routing System

import { Message, MessageType, MessageRoutingRule, RoutingCondition, RoutingAction } from './types';
import { EventEmitter } from 'events';

export interface RoutingTable {
  [agentId: string]: {
    address: string;
    capabilities: string[];
    status: 'online' | 'offline' | 'busy';
    lastSeen: number;
    load: number;
  };
}

export interface RoutingMetrics {
  totalMessages: number;
  routedMessages: number;
  failedRoutes: number;
  averageLatency: number;
  routeHits: Record<string, number>;
}

export class MessageRouter extends EventEmitter {
  private routingTable: RoutingTable = {};
  private routingRules: MessageRoutingRule[] = [];
  private metrics: RoutingMetrics;
  private routeCache: Map<string, string[]> = new Map();
  private maxCacheSize: number = 1000;

  constructor() {
    super();
    this.metrics = {
      totalMessages: 0,
      routedMessages: 0,
      failedRoutes: 0,
      averageLatency: 0,
      routeHits: {}
    };
  }

  /**
   * Route a message to its destination(s)
   */
  public routeMessage(message: Message): string[] {
    const startTime = Date.now();
    this.metrics.totalMessages++;

    try {
      // Check if message is expired
      if (message.expiresAt && message.expiresAt < Date.now()) {
        throw new Error('Message has expired');
      }

      // Apply routing rules
      const processedMessage = this.applyRoutingRules(message);

      // Determine route
      const route = this.determineRoute(processedMessage);

      // Update routing metadata
      if (processedMessage.metadata.routing) {
        processedMessage.metadata.routing.route = route;
        processedMessage.metadata.routing.hops++;
      } else {
        processedMessage.metadata.routing = {
          route,
          hops: 1,
          maxHops: 10
        };
      }

      // Check for routing loops
      if (processedMessage.metadata.routing.hops > processedMessage.metadata.routing.maxHops) {
        throw new Error('Maximum hop count exceeded - possible routing loop');
      }

      // Update metrics
      this.updateMetrics(route, Date.now() - startTime);
      this.metrics.routedMessages++;

      // Emit routing event
      this.emit('messageRouted', {
        message: processedMessage,
        route,
        latency: Date.now() - startTime
      });

      return route;
    } catch (error) {
      this.metrics.failedRoutes++;
      this.emit('routingError', {
        message,
        error: error instanceof Error ? error.message : 'Unknown routing error'
      });
      throw error;
    }
  }

  /**
   * Determine the route for a message
   */
  private determineRoute(message: Message): string[] {
    const recipients = Array.isArray(message.recipient) ? message.recipient : [message.recipient];
    const route: string[] = [];

    for (const recipient of recipients) {
      // Check cache first
      const cacheKey = `${message.sender}-${recipient}-${message.type}`;
      const cachedRoute = this.routeCache.get(cacheKey);

      if (cachedRoute) {
        route.push(...cachedRoute);
        this.metrics.routeHits[cacheKey] = (this.metrics.routeHits[cacheKey] || 0) + 1;
        continue;
      }

      // Find direct route
      if (this.routingTable[recipient]) {
        route.push(recipient);
        this.cacheRoute(cacheKey, [recipient]);
        continue;
      }

      // Find route through capabilities
      const capabilityRoute = this.findRouteByCapability(message, recipient);
      if (capabilityRoute.length > 0) {
        route.push(...capabilityRoute);
        this.cacheRoute(cacheKey, capabilityRoute);
        continue;
      }

      // Broadcast route (if no specific route found)
      if (message.type === MessageType.DISCOVER || message.type === MessageType.HEARTBEAT) {
        const broadcastRoute = this.getBroadcastRoute();
        route.push(...broadcastRoute);
        this.cacheRoute(cacheKey, broadcastRoute);
        continue;
      }

      // No route found
      throw new Error(`No route found for recipient: ${recipient}`);
    }

    return route;
  }

  /**
   * Find route based on agent capabilities
   */
  private findRouteByCapability(message: Message, targetRecipient: string): string[] {
    const route: string[] = [];

    // Look for agents with matching capabilities
    for (const [agentId, agentInfo] of Object.entries(this.routingTable)) {
      if (agentInfo.status === 'offline') continue;

      // Check if agent has the required capability
      if (this.hasCapability(agentInfo.capabilities, message.type)) {
        route.push(agentId);
      }
    }

    return route;
  }

  /**
   * Check if agent has required capability
   */
  private hasCapability(agentCapabilities: string[], messageType: MessageType): boolean {
    // Map message types to required capabilities
    const capabilityMap: Record<MessageType, string[]> = {
      [MessageType.TASK_REQUEST]: ['task_execution'],
      [MessageType.KNOWLEDGE_REQUEST]: ['knowledge_access'],
      [MessageType.CAPABILITY_QUERY]: ['capability_discovery'],
      [MessageType.HEARTBEAT]: ['system'],
      [MessageType.REGISTER]: ['system'],
      [MessageType.UNREGISTER]: ['system'],
      [MessageType.DISCOVER]: ['system'],
      [MessageType.CAPABILITY_RESPONSE]: ['system'],
      [MessageType.TASK_RESPONSE]: ['task_execution'],
      [MessageType.TASK_PROGRESS]: ['task_execution'],
      [MessageType.TASK_COMPLETE]: ['task_execution'],
      [MessageType.TASK_ERROR]: ['task_execution'],
      [MessageType.TASK_CANCEL]: ['task_execution'],
      [MessageType.KNOWLEDGE_SHARE]: ['knowledge_access'],
      [MessageType.KNOWLEDGE_RESPONSE]: ['knowledge_access'],
      [MessageType.KNOWLEDGE_UPDATE]: ['knowledge_access'],
      [MessageType.CONTROL_START]: ['control'],
      [MessageType.CONTROL_STOP]: ['control'],
      [MessageType.CONTROL_PAUSE]: ['control'],
      [MessageType.CONTROL_RESUME]: ['control'],
      [MessageType.ERROR]: ['system'],
      [MessageType.WARNING]: ['system'],
      [MessageType.INFO]: ['system'],
      [MessageType.CUSTOM]: ['custom']
    };

    const requiredCapabilities = capabilityMap[messageType] || ['general'];
    return requiredCapabilities.some(cap => agentCapabilities.includes(cap));
  }

  /**
   * Get broadcast route for discovery messages
   */
  private getBroadcastRoute(): string[] {
    return Object.keys(this.routingTable).filter(
      agentId => this.routingTable[agentId].status === 'online'
    );
  }

  /**
   * Apply routing rules to message
   */
  private applyRoutingRules(message: Message): Message {
    let processedMessage = { ...message };

    // Sort rules by priority (higher priority first)
    const sortedRules = [...this.routingRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!rule.enabled) continue;

      // Check if rule conditions match
      if (this.matchesConditions(processedMessage, rule.conditions)) {
        // Apply rule actions
        processedMessage = this.applyActions(processedMessage, rule.actions);
      }
    }

    return processedMessage;
  }

  /**
   * Check if message matches routing conditions
   */
  private matchesConditions(message: Message, conditions: RoutingCondition[]): boolean {
    return conditions.every(condition => {
      const value = this.getFieldValue(message, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return value === condition.value;
        case 'contains':
          return typeof value === 'string' && value.includes(condition.value);
        case 'regex':
          return typeof value === 'string' && new RegExp(condition.value).test(value);
        case 'range':
          return typeof value === 'number' && 
                 value >= condition.value.min && 
                 value <= condition.value.max;
        case 'exists':
          return value !== undefined && value !== null;
        default:
          return false;
      }
    });
  }

  /**
   * Get field value from message using dot notation
   */
  private getFieldValue(message: Message, field: string): any {
    const parts = field.split('.');
    let value: any = message;

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
   * Apply routing actions to message
   */
  private applyActions(message: Message, actions: RoutingAction[]): Message {
    let processedMessage = { ...message };

    for (const action of actions) {
      switch (action.type) {
        case 'route':
          if (action.parameters.recipient) {
            processedMessage.recipient = action.parameters.recipient;
          }
          break;
        case 'filter':
          // Filter out message if condition is met
          if (action.parameters.condition && this.matchesConditions(processedMessage, [action.parameters.condition])) {
            throw new Error('Message filtered by routing rule');
          }
          break;
        case 'transform':
          // Transform message fields
          if (action.parameters.transformations) {
            for (const [field, value] of Object.entries(action.parameters.transformations)) {
              this.setFieldValue(processedMessage, field, value);
            }
          }
          break;
        case 'log':
          // Log message (emit event)
          this.emit('messageLogged', {
            message: processedMessage,
            logLevel: action.parameters.level || 'info'
          });
          break;
        case 'delay':
          // Add delay metadata
          if (action.parameters.delay) {
            processedMessage.metadata.timeout = (processedMessage.metadata.timeout || 0) + action.parameters.delay;
          }
          break;
      }
    }

    return processedMessage;
  }

  /**
   * Set field value in message using dot notation
   */
  private setFieldValue(message: Message, field: string, value: any): void {
    const parts = field.split('.');
    let current: any = message;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (part && (!(part in current) || typeof current[part] !== 'object')) {
        current[part] = {};
      }
      if (part) {
        current = current[part];
      }
    }

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      current[lastPart] = value;
    }
  }

  /**
   * Cache a route for future use
   */
  private cacheRoute(key: string, route: string[]): void {
    if (this.routeCache.size >= this.maxCacheSize) {
      // Remove least used route
      const leastUsed = Object.entries(this.metrics.routeHits)
        .sort(([,a], [,b]) => a - b)[0];
      if (leastUsed && leastUsed[0]) {
        this.routeCache.delete(leastUsed[0]);
        delete this.metrics.routeHits[leastUsed[0]];
      }
    }

    this.routeCache.set(key, route);
    this.metrics.routeHits[key] = 1;
  }

  /**
   * Update routing metrics
   */
  private updateMetrics(route: string[], latency: number): void {
    // Update average latency
    const totalLatency = this.metrics.averageLatency * (this.metrics.routedMessages - 1) + latency;
    this.metrics.averageLatency = totalLatency / this.metrics.routedMessages;

    // Update route hits
    for (const agentId of route) {
      this.metrics.routeHits[agentId] = (this.metrics.routeHits[agentId] || 0) + 1;
    }
  }

  /**
   * Register an agent in the routing table
   */
  public registerAgent(
    agentId: string,
    address: string,
    capabilities: string[],
    status: 'online' | 'offline' | 'busy' = 'online'
  ): void {
    this.routingTable[agentId] = {
      address,
      capabilities,
      status,
      lastSeen: Date.now(),
      load: 0
    };

    this.emit('agentRegistered', { agentId, address, capabilities, status });
  }

  /**
   * Unregister an agent from the routing table
   */
  public unregisterAgent(agentId: string): void {
    if (this.routingTable[agentId]) {
      delete this.routingTable[agentId];
      this.emit('agentUnregistered', { agentId });
    }
  }

  /**
   * Update agent status
   */
  public updateAgentStatus(agentId: string, status: 'online' | 'offline' | 'busy'): void {
    if (this.routingTable[agentId]) {
      this.routingTable[agentId].status = status;
      this.routingTable[agentId].lastSeen = Date.now();
      this.emit('agentStatusUpdated', { agentId, status });
    }
  }

  /**
   * Add a routing rule
   */
  public addRoutingRule(rule: MessageRoutingRule): void {
    this.routingRules.push(rule);
    this.emit('routingRuleAdded', rule);
  }

  /**
   * Remove a routing rule
   */
  public removeRoutingRule(ruleId: string): void {
    const index = this.routingRules.findIndex(rule => rule.id === ruleId);
    if (index !== -1) {
      const rule = this.routingRules.splice(index, 1)[0];
      this.emit('routingRuleRemoved', rule);
    }
  }

  /**
   * Get routing metrics
   */
  public getMetrics(): RoutingMetrics {
    return { ...this.metrics };
  }

  /**
   * Get routing table
   */
  public getRoutingTable(): RoutingTable {
    return { ...this.routingTable };
  }

  /**
   * Clear route cache
   */
  public clearCache(): void {
    this.routeCache.clear();
    this.metrics.routeHits = {};
  }
} 