# Communication Layer

The Communication Layer is the foundation for all agent-to-agent communication in the AML-AIN system. It provides a robust, scalable, and secure messaging infrastructure that enables seamless interaction between distributed AI agents.

## 🏗️ Architecture

The communication layer consists of five core components:

1. **Message Types & Protocols** (`types.ts`) - Defines message structures, types, and protocols
2. **Message Serialization** (`serializer.ts`) - Handles message encoding/decoding and format conversion
3. **Message Routing** (`router.ts`) - Routes messages between agents based on capabilities and rules
4. **Message Validation** (`validator.ts`) - Validates message structure and content
5. **Message Queue** (`queue.ts`) - Manages message flow, batching, and flow control
6. **Communication Manager** (`manager.ts`) - Orchestrates all communication components

## 🚀 Features

### Core Functionality
- **Message Serialization**: Support for JSON and MessagePack formats with compression and encryption
- **Intelligent Routing**: Route messages based on agent capabilities and custom routing rules
- **Message Validation**: Comprehensive validation with custom schemas and business rules
- **Priority Queues**: Multi-priority message processing with flow control
- **Dead Letter Queue**: Handle failed messages with retry mechanisms
- **Message Batching**: Efficient batch processing for high-throughput scenarios
- **Flow Control**: Backpressure handling and rate limiting
- **Monitoring**: Comprehensive metrics and statistics

### Security & Reliability
- **Message Encryption**: Built-in encryption support (AES-256-GCM, ChaCha20-Poly1305)
- **Message Compression**: Gzip compression for large messages
- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Message Acknowledgment**: Reliable message delivery with ACK/NACK
- **Schema Validation**: Strict message structure validation
- **Versioning**: Message versioning for backward compatibility

### Performance & Scalability
- **Priority Processing**: High-priority messages processed first
- **Batch Processing**: Efficient message batching for throughput
- **Flow Control**: Prevents system overload with backpressure
- **Caching**: Route caching for improved performance
- **Metrics**: Real-time performance monitoring

## 📦 Installation

The communication layer is part of the AML-AIN backend and requires the following dependencies:

```bash
npm install uuid
npm install --save-dev @types/uuid
```

## 🔧 Usage

### Basic Usage

```typescript
import { CommunicationManager, MessageType } from './communication';

// Create a communication manager for an agent
const manager = new CommunicationManager('my-agent-id');

// Send a message
const messageId = await manager.sendMessage(
  MessageType.TASK_REQUEST,
  'target-agent',
  { taskId: 'task-123', taskType: 'computation' }
);

// Receive and process messages
manager.on('messageReceived', ({ message }) => {
  console.log('Received message:', message);
});

// Handle specific message types
manager.on('taskRequest', ({ message }) => {
  // Process task request
  console.log('Processing task:', message.payload);
});
```

### Advanced Configuration

```typescript
import { CommunicationManager, CommunicationConfig } from './communication';

const config: CommunicationConfig = {
  serializer: {
    defaultFormat: 'json',
    compression: true,
    encryption: false
  },
  router: {
    enableRouting: true,
    enableCaching: true,
    maxHops: 10
  },
  validator: {
    enableValidation: true,
    strictMode: false
  },
  queue: {
    maxSize: 10000,
    maxBatchSize: 100,
    processingTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
    deadLetterQueue: true,
    priorityQueues: true,
    flowControl: true
  }
};

const manager = new CommunicationManager('my-agent-id', config);
```

### Message Types

The system supports various message types for different purposes:

```typescript
import { MessageType } from './communication';

// System messages
MessageType.HEARTBEAT        // Health checking
MessageType.REGISTER         // Agent registration
MessageType.UNREGISTER       // Agent unregistration
MessageType.DISCOVER         // Agent discovery
MessageType.CAPABILITY_QUERY // Capability inquiry

// Task messages
MessageType.TASK_REQUEST     // Task execution request
MessageType.TASK_RESPONSE    // Task execution response
MessageType.TASK_PROGRESS    // Task progress update
MessageType.TASK_COMPLETE    // Task completion
MessageType.TASK_ERROR       // Task error
MessageType.TASK_CANCEL      // Task cancellation

// Knowledge messages
MessageType.KNOWLEDGE_SHARE  // Knowledge sharing
MessageType.KNOWLEDGE_REQUEST // Knowledge request
MessageType.KNOWLEDGE_RESPONSE // Knowledge response
MessageType.KNOWLEDGE_UPDATE // Knowledge update

// Control messages
MessageType.CONTROL_START    // Start control
MessageType.CONTROL_STOP     // Stop control
MessageType.CONTROL_PAUSE    // Pause control
MessageType.CONTROL_RESUME   // Resume control

// Error messages
MessageType.ERROR            // Error notification
MessageType.WARNING          // Warning notification
MessageType.INFO             // Information notification

// Custom messages
MessageType.CUSTOM           // Custom message type
```

### Routing Rules

Create custom routing rules for message processing:

```typescript
import { MessageRoutingRule } from './communication';

const routingRule: MessageRoutingRule = {
  id: 'high-priority-rule',
  name: 'High Priority Task Routing',
  conditions: [
    { field: 'type', operator: 'equals', value: MessageType.TASK_REQUEST },
    { field: 'priority', operator: 'range', value: { min: 4, max: 5 } }
  ],
  actions: [
    { type: 'route', parameters: { recipient: 'high-priority-agent' } },
    { type: 'log', parameters: { level: 'info' } }
  ],
  priority: 1,
  enabled: true
};

manager.addRoutingRule(routingRule);
```

### Validation Rules

Add custom validation rules:

```typescript
import { ValidationRule } from './communication';

const validationRule: ValidationRule = {
  id: 'task-validation',
  name: 'Task Request Validation',
  field: 'payload.taskId',
  type: 'required',
  message: 'Task ID is required for task requests',
  enabled: true
};

// Add to validator
const validator = MessageValidator.getInstance();
validator.addRule(validationRule);
```

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all communication layer tests
npm test -- --config jest.config.simple.js backend/communication/__tests__/

# Run specific test file
npm test -- --config jest.config.simple.js backend/communication/__tests__/communication.test.ts

# Run with coverage
npm test -- --config jest.config.simple.js --coverage backend/communication/
```

The test suite covers:
- Message creation and validation
- Serialization and deserialization
- Routing and message delivery
- Queue management and flow control
- Integration scenarios
- Error handling and edge cases

## 📊 Monitoring

Access communication statistics and metrics:

```typescript
// Get overall statistics
const stats = manager.getStats();
console.log('Messages sent:', stats.messagesSent);
console.log('Messages received:', stats.messagesReceived);
console.log('Average latency:', stats.averageLatency);

// Get queue statistics
const queueStats = manager.getQueueStats();
console.log('Queue size:', queueStats.size);
console.log('Messages processed:', queueStats.processed);
console.log('Failed messages:', queueStats.failed);

// Get routing statistics
const routingStats = manager.getRoutingTable();
console.log('Registered agents:', Object.keys(routingStats).length);

// Get flow control status
const flowControl = manager.getFlowControl();
console.log('Backpressure active:', flowControl.backpressure);
console.log('Current window:', flowControl.currentWindow);
```

## 🔒 Security

The communication layer includes several security features:

1. **Message Encryption**: Built-in support for message encryption
2. **Schema Validation**: Prevents malformed or malicious messages
3. **Access Control**: Route-based access control
4. **Message Signing**: Cryptographic message signing (planned)
5. **Rate Limiting**: Prevents message flooding
6. **Input Sanitization**: Validates all message content

## 🚀 Performance

Performance optimizations include:

1. **Message Batching**: Reduces overhead for high-volume messaging
2. **Route Caching**: Caches frequently used routes
3. **Priority Queues**: Processes high-priority messages first
4. **Flow Control**: Prevents system overload
5. **Compression**: Reduces bandwidth usage
6. **Connection Pooling**: Efficient resource utilization

## 🔧 Configuration

### Environment Variables

```bash
# Communication settings
COMMUNICATION_DEFAULT_FORMAT=json
COMMUNICATION_COMPRESSION=true
COMMUNICATION_ENCRYPTION=false
COMMUNICATION_MAX_QUEUE_SIZE=10000
COMMUNICATION_MAX_BATCH_SIZE=100
COMMUNICATION_PROCESSING_TIMEOUT=30000
COMMUNICATION_RETRY_ATTEMPTS=3
COMMUNICATION_RETRY_DELAY=1000
```

### Configuration File

```json
{
  "communication": {
    "serializer": {
      "defaultFormat": "json",
      "compression": true,
      "encryption": false
    },
    "router": {
      "enableRouting": true,
      "enableCaching": true,
      "maxHops": 10
    },
    "validator": {
      "enableValidation": true,
      "strictMode": false
    },
    "queue": {
      "maxSize": 10000,
      "maxBatchSize": 100,
      "processingTimeout": 30000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "deadLetterQueue": true,
      "priorityQueues": true,
      "flowControl": true
    }
  }
}
```

## 🔄 Integration

The communication layer integrates with:

1. **Agent Framework**: Provides messaging for all agents
2. **Orchestration Engine**: Coordinates agent communication
3. **Knowledge System**: Shares knowledge between agents
4. **Monitoring System**: Provides metrics and health checks
5. **Security System**: Handles authentication and authorization

## 📈 Future Enhancements

Planned improvements include:

1. **WebSocket Support**: Real-time bidirectional communication
2. **Message Signing**: Cryptographic message authentication
3. **Advanced Encryption**: End-to-end encryption
4. **Message Persistence**: Persistent message storage
5. **Load Balancing**: Distributed message routing
6. **Message Replay**: Message replay capabilities
7. **Advanced Metrics**: Detailed performance analytics
8. **Plugin System**: Extensible message processors

## 🤝 Contributing

When contributing to the communication layer:

1. Follow the existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Ensure backward compatibility
5. Add performance benchmarks for optimizations

## 📄 License

This communication layer is part of the AML-AIN project and follows the same licensing terms. 