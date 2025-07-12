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