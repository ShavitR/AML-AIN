const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const orchestrator = require('./orchestrator');

// Middleware
app.use(cors());
app.use(express.json());
// Serve static files first
app.use(express.static(path.join(__dirname, '../../../frontend/dist')));

// Mock data for demonstration
const mockAgents = [
  {
    id: 'agent-1',
    name: 'Data Processing Agent',
    type: 'DataProcessor',
    status: 'online',
    capabilities: ['data-processing', 'ml-training'],
    lastSeen: '2 minutes ago',
    health: 'healthy',
    lifecycleState: 'running'
  },
  {
    id: 'agent-2',
    name: 'Communication Agent',
    type: 'Communicator',
    status: 'online',
    capabilities: ['message-routing', 'protocol-handling'],
    lastSeen: '1 minute ago',
    health: 'healthy',
    lifecycleState: 'running'
  },
  {
    id: 'agent-3',
    name: 'Discovery Agent',
    type: 'Discoverer',
    status: 'offline',
    capabilities: ['agent-discovery', 'health-monitoring'],
    lastSeen: '5 minutes ago',
    health: 'unhealthy',
    lifecycleState: 'stopped'
  }
];

const mockSystemMetrics = {
  cpu: 25,
  memory: 45,
  activeAgents: 3,
  messagesPerSecond: 75,
  queues: 8,
  connections: 15,
  pendingMessages: 30
};

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/agents', (req, res) => {
  // Simulate some variation in the data
  const agents = mockAgents.map(agent => ({
    ...agent,
    lastSeen: `${Math.floor(Math.random() * 5) + 1} minutes ago`,
    health: Math.random() > 0.8 ? 'unhealthy' : 'healthy'
  }));
  
  res.json({ agents });
});

app.get('/api/metrics', (req, res) => {
  // Simulate real-time metrics
  const metrics = {
    ...mockSystemMetrics,
    cpu: Math.floor(Math.random() * 30) + 20,
    memory: Math.floor(Math.random() * 40) + 30,
    messagesPerSecond: Math.floor(Math.random() * 100) + 50
  };
  
  res.json(metrics);
});

app.get('/api/communication/status', (req, res) => {
  const status = {
    queues: Math.floor(Math.random() * 10) + 5,
    connections: Math.floor(Math.random() * 20) + 10,
    pendingMessages: Math.floor(Math.random() * 50) + 20
  };
  
  res.json(status);
});

app.post('/api/agents/register', (req, res) => {
  const { name, type, capabilities } = req.body;
  
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type are required' });
  }
  
  const newAgent = {
    id: `agent-${Date.now()}`,
    name,
    type,
    status: 'online',
    capabilities: capabilities || [],
    lastSeen: 'just now',
    health: 'healthy',
    lifecycleState: 'initializing'
  };
  
  mockAgents.push(newAgent);
  
  // Notify WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'agent_registered',
        agent: newAgent
      }));
    }
  });
  
  res.json({ success: true, agent: newAgent });
});

app.post('/api/agents/:id/action', (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  
  const agent = mockAgents.find(a => a.id === id);
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  switch (action) {
    case 'start':
      agent.status = 'online';
      agent.health = 'healthy';
      agent.lifecycleState = 'running';
      break;
    case 'stop':
      agent.status = 'offline';
      agent.lifecycleState = 'stopped';
      break;
    case 'restart':
      agent.status = 'online';
      agent.health = 'healthy';
      agent.lifecycleState = 'running';
      break;
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
  
  // Notify WebSocket clients
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'agent_status_update',
        agent
      }));
    }
  });
  
  res.json({ success: true, agent });
});

// API: Submit a new job
app.post('/api/orchestration/jobs', (req, res) => {
  try {
    const job = orchestrator.submitJob(req.body);
    orchestrator.log(`Job submitted: ${job.id}`);
    res.status(201).json({ job });
  } catch (err) {
    orchestrator.log(`Job submission error: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// API: Get job status
app.get('/api/orchestration/jobs/:jobId', (req, res) => {
  const job = orchestrator.jobs?.find(j => j.id === req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ job });
});

// API: Get task queue
app.get('/api/orchestration/tasks', (req, res) => {
  res.json({ tasks: orchestrator.tasks || [] });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Send initial data
  ws.send(JSON.stringify({
    type: 'initial_data',
    agents: mockAgents,
    metrics: mockSystemMetrics
  }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
        case 'request_metrics':
          ws.send(JSON.stringify({
            type: 'metrics_update',
            metrics: {
              ...mockSystemMetrics,
              cpu: Math.floor(Math.random() * 30) + 20,
              memory: Math.floor(Math.random() * 40) + 30,
              messagesPerSecond: Math.floor(Math.random() * 100) + 50
            }
          }));
          break;
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Periodic updates
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'system_metrics_update',
        metrics: {
          ...mockSystemMetrics,
          cpu: Math.floor(Math.random() * 30) + 20,
          memory: Math.floor(Math.random() * 40) + 30,
          messagesPerSecond: Math.floor(Math.random() * 100) + 50
        }
      }));
    }
  });
}, 30000); // Update every 30 seconds

// Only serve index.html for non-file, non-API requests (SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next(); // Don't serve index.html for API or WebSocket routes
  }
  // If the request does not have a file extension, serve index.html
  if (!path.extname(req.path)) {
    res.sendFile(path.join(__dirname, '../../../frontend/dist/index.html'));
  } else {
    next();
  }
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 AML-AIN Orchestrator running on port ${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server ready for real-time updates`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
}); 