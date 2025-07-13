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

// Mock system logs
const systemLogs = [
  { timestamp: new Date().toISOString(), level: 'info', message: 'System initialized successfully' },
  { timestamp: new Date().toISOString(), level: 'info', message: 'WebSocket connection established' },
  { timestamp: new Date().toISOString(), level: 'info', message: 'Agent discovery service started' },
  { timestamp: new Date().toISOString(), level: 'info', message: 'Communication layer active' },
  { timestamp: new Date().toISOString(), level: 'warn', message: 'High memory usage detected' },
  { timestamp: new Date().toISOString(), level: 'error', message: 'Agent-3 connection timeout' }
];

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/agents', (req, res) => {
  res.json({ agents: mockAgents });
});

app.get('/api/metrics', (req, res) => {
  // Update metrics with real-time data
  const updatedMetrics = {
    ...mockSystemMetrics,
    cpu: Math.floor(Math.random() * 30) + 20,
    memory: Math.floor(Math.random() * 40) + 30,
    messagesPerSecond: Math.floor(Math.random() * 100) + 50
  };
  res.json(updatedMetrics);
});

app.get('/api/communication/status', (req, res) => {
  res.json({
    queues: mockSystemMetrics.queues,
    connections: mockSystemMetrics.connections,
    pendingMessages: mockSystemMetrics.pendingMessages
  });
});

// Agent registration endpoint
app.post('/api/agents/register', (req, res) => {
  try {
    const { name, type, capabilities } = req.body;
    
    // Validate required fields
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' });
    }
    
    // Create new agent
    const newAgent = {
      id: `agent-${Date.now()}`,
      name,
      type,
      status: 'online',
      capabilities: capabilities ? capabilities.split(',').map(c => c.trim()) : [],
      lastSeen: 'just now',
      health: 'healthy',
      lifecycleState: 'running'
    };
    
    mockAgents.push(newAgent);
    
    res.status(201).json({ agent: newAgent, message: 'Agent registered successfully' });
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({ error: 'Failed to register agent' });
  }
});

// Agent action endpoint
app.post('/api/agents/:id/action', (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    
    const agent = mockAgents.find(a => a.id === id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    // Handle different actions
    switch (action) {
      case 'start':
        agent.status = 'online';
        agent.health = 'healthy';
        agent.lifecycleState = 'running';
        agent.lastSeen = 'just now';
        break;
      case 'stop':
        agent.status = 'offline';
        agent.lifecycleState = 'stopped';
        break;
      case 'restart':
        agent.status = 'online';
        agent.health = 'healthy';
        agent.lifecycleState = 'running';
        agent.lastSeen = 'just now';
        break;
      case 'deregister':
        const index = mockAgents.findIndex(a => a.id === id);
        if (index > -1) {
          mockAgents.splice(index, 1);
        }
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json({ 
      success: true, 
      message: `Agent ${action} successful`,
      agent: action === 'deregister' ? null : agent
    });
  } catch (error) {
    console.error('Agent action error:', error);
    res.status(500).json({ error: 'Failed to perform agent action' });
  }
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
  const job = orchestrator.jobs.find(j => j.id === req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

// API: Get all jobs
app.get('/api/orchestration/jobs', (req, res) => {
  res.json({ jobs: orchestrator.jobs });
});

// API: Get task queue
app.get('/api/orchestration/tasks', (req, res) => {
  res.json({ tasks: orchestrator.tasks });
});

// API: Get system logs
app.get('/api/logs', (req, res) => {
  const { level, limit = 100 } = req.query;
  
  let filteredLogs = systemLogs;
  
  // Filter by level if specified
  if (level && level !== '') {
    filteredLogs = systemLogs.filter(log => log.level === level);
  }
  
  // Limit results
  filteredLogs = filteredLogs.slice(-limit);
  
  res.json({ logs: filteredLogs });
});

// API: Add system log
app.post('/api/logs', (req, res) => {
  try {
    const { level, message } = req.body;
    
    if (!level || !message) {
      return res.status(400).json({ error: 'Level and message are required' });
    }
    
    const newLog = {
      timestamp: new Date().toISOString(),
      level,
      message
    };
    
    systemLogs.push(newLog);
    
    // Keep only last 1000 logs
    if (systemLogs.length > 1000) {
      systemLogs.splice(0, systemLogs.length - 1000);
    }
    
    res.status(201).json({ log: newLog });
  } catch (error) {
    console.error('Log creation error:', error);
    res.status(500).json({ error: 'Failed to create log entry' });
  }
});

// API: Clear system logs
app.delete('/api/logs', (req, res) => {
  systemLogs.length = 0;
  res.json({ message: 'Logs cleared successfully' });
});

// API: Download logs
app.get('/api/logs/download', (req, res) => {
  const logText = systemLogs
    .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
    .join('\n');
  
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="system-logs.txt"');
  res.send(logText);
});

// API: Get system configuration
app.get('/api/config', (req, res) => {
  res.json({
    apiUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001',
    debug: true,
    version: '1.0.0',
    environment: 'development'
  });
});

// API: Update system configuration
app.put('/api/config', (req, res) => {
  try {
    const { apiUrl, wsUrl, debug } = req.body;
    
    // Validate configuration
    const errors = [];
    
    if (apiUrl && typeof apiUrl !== 'string') {
      errors.push('apiUrl must be a string');
    }
    
    if (wsUrl && typeof wsUrl !== 'string') {
      errors.push('wsUrl must be a string');
    }
    
    if (debug !== undefined && typeof debug !== 'boolean') {
      errors.push('debug must be a boolean');
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid configuration', 
        details: errors 
      });
    }
    
    // Update configuration (in a real app, this would be persisted)
    console.log('Configuration updated:', { apiUrl, wsUrl, debug });
    
    res.json({ 
      message: 'Configuration updated successfully',
      config: { apiUrl, wsUrl, debug }
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
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
        case 'request_agents':
          ws.send(JSON.stringify({
            type: 'agent_update',
            agents: mockAgents
          }));
          break;
        case 'request_communication':
          ws.send(JSON.stringify({
            type: 'communication_update',
            status: {
              queues: mockSystemMetrics.queues,
              connections: mockSystemMetrics.connections,
              pendingMessages: mockSystemMetrics.pendingMessages
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

// Periodic updates to connected clients
setInterval(() => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'metrics_update',
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

// Serve the frontend application
app.get('*', (req, res, next) => {
  // Only serve index.html for non-file, non-API requests (SPA routing)
  if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
    return next(); // Don't serve index.html for API or WebSocket routes
  }
  
  res.sendFile(path.join(__dirname, '../../../frontend/dist/index.html'));
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 AML-AIN Backend Server running on port ${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}`);
});

module.exports = app; 