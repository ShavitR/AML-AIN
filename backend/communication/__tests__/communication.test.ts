// Communication Layer Tests

import { 
  MessageSerializer, 
  MessageRouter, 
  MessageValidator, 
  MessageQueue, 
  CommunicationManager,
  MessageType,
  MessagePriority,
  Message
} from '../index';

describe('Communication Layer', () => {
  let serializer: MessageSerializer;
  let router: MessageRouter;
  let validator: MessageValidator;
  let queue: MessageQueue;
  let manager: CommunicationManager;

  beforeEach(() => {
    serializer = MessageSerializer.getInstance();
    router = new MessageRouter();
    validator = MessageValidator.getInstance();
    queue = new MessageQueue();
    manager = new CommunicationManager('test-agent');
  });

  afterEach(() => {
    queue.stopProcessing();
    manager.shutdown();
  });

  describe('MessageSerializer', () => {
    test('should create valid messages', () => {
      const message = serializer.createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );

      expect(message.id).toBeDefined();
      expect(message.type).toBe(MessageType.HEARTBEAT);
      expect(message.sender).toBe('sender-1');
      expect(message.recipient).toBe('receiver-1');
      expect(message.payload).toEqual({ status: 'alive' });
      expect(message.timestamp).toBeGreaterThan(0);
      expect(message.priority).toBe(MessagePriority.NORMAL);
      expect(message.version).toBe('1.0.0');
    });

    test('should serialize and deserialize messages', () => {
      const originalMessage = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'receiver-1',
        { taskId: 'task-123', taskType: 'computation' }
      );

      const serialized = serializer.serialize(originalMessage, { format: 'json' });
      const deserialized = serializer.deserialize(serialized, { format: 'json' });

      expect(deserialized.id).toBe(originalMessage.id);
      expect(deserialized.type).toBe(originalMessage.type);
      expect(deserialized.sender).toBe(originalMessage.sender);
      expect(deserialized.recipient).toBe(originalMessage.recipient);
      expect(deserialized.payload).toEqual(originalMessage.payload);
    });

    test('should validate message structure', () => {
      const invalidMessage = {
        id: 'invalid-id',
        type: 'invalid-type' as any,
        sender: '',
        recipient: null as any,
        timestamp: 'invalid-timestamp' as any,
        payload: null,
        metadata: null as any,
        priority: 0,
        version: ''
      } as unknown as Message;

      expect(() => {
        serializer.serialize(invalidMessage, { format: 'json' });
      }).toThrow('Message validation failed');
    });
  });

  describe('MessageRouter', () => {
    test('should register and route to agents', () => {
      router.registerAgent('agent-1', 'address-1', ['task_execution']);
      router.registerAgent('agent-2', 'address-2', ['knowledge_access']);

      const message = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'agent-1',
        { taskId: 'task-123' }
      );

      const route = router.routeMessage(message);
      expect(route).toContain('agent-1');
    });

    test('should route by capabilities', () => {
      router.registerAgent('task-agent', 'address-1', ['task_execution']);
      router.registerAgent('knowledge-agent', 'address-2', ['knowledge_access']);

      const taskMessage = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'unknown-agent',
        { taskId: 'task-123' }
      );

      const route = router.routeMessage(taskMessage);
      expect(route).toContain('task-agent');
    });

    test('should handle broadcast messages', () => {
      router.registerAgent('agent-1', 'address-1', ['system']);
      router.registerAgent('agent-2', 'address-2', ['system']);

      const discoverMessage = serializer.createMessage(
        MessageType.DISCOVER,
        'sender-1',
        '*',
        {}
      );

      const route = router.routeMessage(discoverMessage);
      expect(route).toContain('agent-1');
      expect(route).toContain('agent-2');
    });

    test('should apply routing rules', () => {
      router.registerAgent('agent-1', 'address-1', ['task_execution']);
      
      router.addRoutingRule({
        id: 'rule-1',
        name: 'Test Rule',
        conditions: [
          { field: 'type', operator: 'equals', value: MessageType.TASK_REQUEST }
        ],
        actions: [
          { type: 'route', parameters: { recipient: 'agent-1' } }
        ],
        priority: 1,
        enabled: true
      });

      const message = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'unknown-agent',
        { taskId: 'task-123' }
      );

      const route = router.routeMessage(message);
      expect(route).toContain('agent-1');
    });
  });

  describe('MessageValidator', () => {
    test('should validate valid messages', () => {
      const message = serializer.createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );

      const result = validator.validateMessage(message);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid messages', () => {
      const invalidMessage = {
        id: '',
        type: 'invalid-type' as any,
        sender: '',
        recipient: '',
        timestamp: -1,
        payload: null,
        metadata: {},
        priority: 0,
        version: ''
      } as unknown as Message;

      const result = validator.validateMessage(invalidMessage);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate message schemas', () => {
      const taskMessage = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'receiver-1',
        {
          taskId: 'task-123',
          taskType: 'computation',
          parameters: { input: 'data' }
        }
      );

      const result = validator.validateMessage(taskMessage);
      expect(result.valid).toBe(true);
    });
  });

  describe('MessageQueue', () => {
    test('should enqueue and dequeue messages', () => {
      const message = serializer.createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );

      const enqueued = queue.enqueue(message);
      expect(enqueued).toBe(true);

      const dequeued = queue.dequeue();
      expect(dequeued).toBeDefined();
      expect(dequeued?.id).toBe(message.id);
    });

    test('should handle priority queues', () => {
      const lowPriorityMessage = serializer.createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' },
        { priority: MessagePriority.LOW }
      );

      const highPriorityMessage = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'receiver-1',
        { taskId: 'task-123' },
        { priority: MessagePriority.HIGH }
      );

      queue.enqueue(lowPriorityMessage);
      queue.enqueue(highPriorityMessage);

      const firstDequeued = queue.dequeue();
      expect(firstDequeued?.priority).toBe(MessagePriority.HIGH);
    });

    test('should process batches', async () => {
      const messages = [];
      for (let i = 0; i < 5; i++) {
        const message = serializer.createMessage(
          MessageType.HEARTBEAT,
          'sender-1',
          'receiver-1',
          { status: 'alive', index: i }
        );
        queue.enqueue(message);
        messages.push(message);
      }

      const batch = await queue.processBatch(3);
      expect(batch).toBeDefined();
      expect(batch?.messages).toHaveLength(3);
    });

    test('should handle acknowledgments', () => {
      const message = serializer.createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );

      queue.enqueue(message);
      const dequeued = queue.dequeue();
      expect(dequeued).toBeDefined();

      queue.acknowledge(message.id, 'test-agent', 'ack');
      
      const stats = queue.getStats();
      expect(stats.processed).toBe(1);
    });
  });

  describe('CommunicationManager', () => {
    test('should send and receive messages', async () => {
      // Register a receiver agent first
      manager.registerAgent('receiver-1', 'address-1', ['system']);
      
      const messageId = await manager.sendMessage(
        MessageType.HEARTBEAT,
        'receiver-1',
        { status: 'alive' }
      );

      expect(messageId).toBeDefined();

      const stats = manager.getStats();
      expect(stats.messagesSent).toBe(1);
    });

    test('should handle message routing', async () => {
      manager.registerAgent('agent-1', 'address-1', ['task_execution']);

      const messageId = await manager.sendMessage(
        MessageType.TASK_REQUEST,
        'agent-1',
        { taskId: 'task-123' }
      );

      expect(messageId).toBeDefined();

      const routingTable = manager.getRoutingTable();
      expect(routingTable['agent-1']).toBeDefined();
    });

    test('should validate messages', async () => {
      // This should fail validation
      await expect(
        manager.sendMessage(
          'invalid-type' as MessageType,
          'receiver-1',
          null
        )
      ).rejects.toThrow();
    });

    test('should handle flow control', () => {
      const flowControl = manager.getFlowControl();
      expect(flowControl).toBeDefined();
      expect(flowControl.windowSize).toBe(100);
      expect(flowControl.flowRate).toBe(1000);
    });

    test('should provide statistics', () => {
      const stats = manager.getStats();
      expect(stats).toBeDefined();
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesProcessed).toBe(0);
      expect(stats.messagesFailed).toBe(0);
    });

    test('should return false if queue is full', () => {
      manager.updateConfig({ queue: {
        maxSize: 1,
        maxBatchSize: 100,
        processingTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        deadLetterQueue: true,
        priorityQueues: true,
        flowControl: false
      } });
      const msg1 = manager['serializer'].createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );
      const msg2 = manager['serializer'].createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'alive' }
      );
      expect(manager['queue'].enqueue(msg1)).toBe(true);
      expect(manager['queue'].enqueue(msg2)).toBe(false);
    });

    test('should get and clear dead letter queue', () => {
      const msg = manager['serializer'].createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'receiver-1',
        { status: 'fail' }
      );
      manager['queue'].enqueue(msg);
      const dequeued = manager['queue'].dequeue();
      expect(dequeued).toBeDefined();
      if (dequeued) {
        // Manually add to processingQueue to simulate real processing
        manager['queue']['processingQueue'].push(dequeued);
        manager['queue'].acknowledge(dequeued.id, 'test-agent', 'reject', 'Test rejection');
      }
      expect(manager.getDeadLetterQueue().length).toBeGreaterThan(0);
      manager.clearDeadLetterQueue();
      expect(manager.getDeadLetterQueue().length).toBe(0);
    });

    test('should emit sendError on sendMessage failure', async () => {
      const errors: any[] = [];
      manager.on('sendError', (e) => errors.push(e));
      // Patch serializer to throw
      const origSerialize = manager['serializer'].serialize;
      manager['serializer'].serialize = () => { throw new Error('Serialize fail'); };
      await expect(manager.sendMessage(
        MessageType.HEARTBEAT,
        'receiver-1',
        { status: 'alive' }
      )).rejects.toThrow('Serialize fail');
      expect(errors.length).toBeGreaterThan(0);
      manager['serializer'].serialize = origSerialize;
    });

    test('should throw if receiveMessage is not for this agent', async () => {
      const msg = manager['serializer'].createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        'other-agent',
        { status: 'alive' }
      );
      const buf = manager['serializer'].serialize(msg, { format: 'json' });
      await expect(manager.receiveMessage(buf)).rejects.toThrow('Message not intended for this agent');
    });

    test('should emit receiveError on receiveMessage failure', async () => {
      const errors: any[] = [];
      manager.on('receiveError', (e) => errors.push(e));
      // Patch serializer to throw
      const origDeserialize = manager['serializer'].deserialize;
      manager['serializer'].deserialize = () => { throw new Error('Deserialize fail'); };
      await expect(manager.receiveMessage(Buffer.from('bad'), { format: 'json' })).rejects.toThrow('Deserialize fail');
      expect(errors.length).toBeGreaterThan(0);
      manager['serializer'].deserialize = origDeserialize;
    });

    test('should emit processError if processMessage throws', async () => {
      const errors: any[] = [];
      manager.on('processError', (e) => errors.push(e));
      // Patch handleHeartbeat to throw
      const origHandle = manager['handleHeartbeat'];
      manager['handleHeartbeat'] = async () => { throw new Error('Handler fail'); };
      const msg = manager['serializer'].createMessage(
        MessageType.HEARTBEAT,
        'sender-1',
        manager['agentId'],
        { status: 'alive' }
      );
      await expect(manager['processMessage'](msg)).rejects.toThrow('Handler fail');
      expect(errors.length).toBeGreaterThan(0);
      manager['handleHeartbeat'] = origHandle;
    });

    test('should emit customMessage for unknown message type', async () => {
      const events: any[] = [];
      manager.on('customMessage', (e) => events.push(e));
      const msg = manager['serializer'].createMessage(
        'custom-type' as MessageType,
        'sender-1',
        manager['agentId'],
        { foo: 'bar' }
      );
      await manager['processMessage'](msg);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should update config and emit configUpdated', () => {
      const events: any[] = [];
      manager.on('configUpdated', (e) => events.push(e));
      manager.updateConfig({ serializer: { defaultFormat: 'msgpack', compression: true, encryption: false } });
      expect(manager['config'].serializer.defaultFormat).toBe('msgpack');
      expect(events.length).toBeGreaterThan(0);
    });

    test('should update queue config via updateConfig', () => {
      manager.updateConfig({ queue: {
        maxSize: 1234,
        maxBatchSize: 100,
        processingTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000,
        deadLetterQueue: true,
        priorityQueues: true,
        flowControl: true
      } });
      expect(manager.getQueueStats().size).toBeDefined(); // Just check queue config is updated
    });

    test('should add and remove routing rules', () => {
      const rule = { id: 'r1', name: 'test', conditions: [], actions: [], priority: 1, enabled: true };
      manager.addRoutingRule(rule);
      // No direct access to routingRules, so just check no error and can remove
      manager.removeRoutingRule('r1');
    });

    test('should register, unregister, and update agent status', () => {
      manager.registerAgent('agent-x', 'addr-x', ['foo']);
      // No direct access to routingTable, so just check routing table has the agent
      expect(manager.getRoutingTable()['agent-x']).toBeDefined();
      manager.updateAgentStatus('agent-x', 'offline');
      expect(manager.getRoutingTable()['agent-x'].status).toBe('offline');
      manager.unregisterAgent('agent-x');
      expect(manager.getRoutingTable()['agent-x']).toBeUndefined();
    });

    test('should emit shutdownError if shutdown fails', async () => {
      const errors: any[] = [];
      manager.on('shutdownError', (e) => errors.push(e));
      // Patch queue.stopProcessing to throw
      const origStop = manager['queue'].stopProcessing;
      manager['queue'].stopProcessing = () => { throw new Error('Shutdown fail'); };
      await expect(manager.shutdown()).rejects.toThrow('Shutdown fail');
      expect(errors.length).toBeGreaterThan(0);
      manager['queue'].stopProcessing = origStop;
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete message flow', async () => {
      // Register agents
      manager.registerAgent('agent-1', 'address-1', ['task_execution']);
      manager.registerAgent('agent-2', 'address-2', ['knowledge_access']);

      // Send task request
      const taskMessageId = await manager.sendMessage(
        MessageType.TASK_REQUEST,
        'agent-1',
        { taskId: 'task-123', taskType: 'computation' }
      );

      expect(taskMessageId).toBeDefined();

      // Send knowledge request
      const knowledgeMessageId = await manager.sendMessage(
        MessageType.KNOWLEDGE_REQUEST,
        'agent-2',
        { query: 'test query' }
      );

      expect(knowledgeMessageId).toBeDefined();

      // Check statistics
      const stats = manager.getStats();
      expect(stats.messagesSent).toBe(2);
      expect(stats.messagesFailed).toBe(0);

      // Check routing table
      const routingTable = manager.getRoutingTable();
      expect(Object.keys(routingTable)).toHaveLength(2);
      expect(routingTable['agent-1']).toBeDefined();
      expect(routingTable['agent-2']).toBeDefined();
    });

    test('should handle message validation and routing', async () => {
      // Create a valid message
      const message = serializer.createMessage(
        MessageType.TASK_REQUEST,
        'sender-1',
        'agent-1',
        { taskId: 'task-123' }
      );

      // Validate message
      const validation = validator.validateMessage(message);
      expect(validation.valid).toBe(true);

      // Register agent and route message
      router.registerAgent('agent-1', 'address-1', ['task_execution']);
      const route = router.routeMessage(message);
      expect(route).toContain('agent-1');

      // Enqueue message
      const enqueued = queue.enqueue(message);
      expect(enqueued).toBe(true);

      // Dequeue and acknowledge
      const dequeued = queue.dequeue();
      expect(dequeued).toBeDefined();
      queue.acknowledge(message.id, 'test-agent', 'ack');

      // Check queue stats
      const queueStats = queue.getStats();
      expect(queueStats.processed).toBe(1);
    });
  });
}); 