// AML-AIN Frontend Application
// Entry point for the frontend application

console.log('AML-AIN Frontend Application Starting...');

// Main application class
class AMLApp {
  constructor() {
    this.initialized = false;
    this.config = {
      apiUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
      debug: process.env.NODE_ENV === 'development'
    };
    this.currentUser = {
      id: 'user-1',
      name: 'Admin User',
      role: 'admin',
      email: 'admin@aml-ain.com'
    };
    this.currentView = 'dashboard';
  }

  async init() {
    try {
      console.log('Initializing AML-AIN Frontend...');
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Mark as initialized
      this.initialized = true;
      
      console.log('AML-AIN Frontend initialized successfully');
      
      // Trigger ready event
      this.onReady();
      
    } catch (error) {
      console.error('Failed to initialize AML-AIN Frontend:', error);
      this.handleError(error);
    }
  }

  async initializeComponents() {
    // Initialize core components
    await this.initializeUI();
    await this.initializeAPI();
    await this.initializeWebSocket();
  }

  async initializeUI() {
    // Create main UI structure
    this.createMainLayout();
    
    // Initialize dashboard
    this.initializeDashboard();
  }

  createMainLayout() {
    const app = document.getElementById('app');
    if (!app) {
      console.error('App container not found');
      return;
    }

    // Sanitize user data before rendering
    const sanitizedUserName = this.escapeHtml(this.currentUser.name);
    
    app.innerHTML = `
      <div class="min-h-screen bg-gray-50">
        <!-- Header -->
        <header class="bg-white shadow-sm border-b border-gray-200">
          <div class="container mx-auto px-4 py-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <h1 class="text-2xl font-bold text-primary">AML-AIN</h1>
                <span class="ml-2 text-sm text-gray-500">Adaptive Meta-Learning AI Network</span>
              </div>
              <div class="flex items-center space-x-4">
                <div class="status status-online">
                  <span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  System Online
                </div>
                <div class="flex items-center space-x-2">
                  <span class="text-sm text-gray-600">Welcome, ${sanitizedUserName}</span>
                  <button class="btn btn-secondary btn-sm" id="user-menu-btn">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                  </button>
                </div>
                <button class="btn btn-secondary btn-sm" id="settings-btn">
                  Settings
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Navigation -->
        <nav class="bg-white border-b border-gray-200">
          <div class="container mx-auto px-4">
            <div class="flex space-x-8">
              <button class="nav-item active" data-view="dashboard">
                Dashboard
              </button>
              <button class="nav-item" data-view="agents">
                Agents
              </button>
              <button class="nav-item" data-view="communication">
                Communication
              </button>
              <button class="nav-item" data-view="orchestration">
                Orchestration
              </button>
              <button class="nav-item" data-view="logs">
                System Logs
              </button>
            </div>
          </div>
        </nav>

        <!-- Main Content -->
        <main class="container mx-auto px-4 py-8">
          <!-- Dashboard View -->
          <div id="dashboard-view" class="view-content">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <!-- Agent Status -->
              <div class="lg:col-span-2">
                <div class="card">
                  <h2 class="text-xl font-semibold mb-4">Agent Status</h2>
                  <div id="agent-status" class="space-y-4">
                    <div class="animate-pulse">
                      <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- System Metrics -->
              <div class="lg:col-span-1">
                <div class="card">
                  <h2 class="text-xl font-semibold mb-4">System Metrics</h2>
                  <div id="system-metrics" class="space-y-4">
                    <div class="animate-pulse">
                      <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                      <div class="h-4 bg-gray-200 rounded w-2/3"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Communication Layer -->
            <div class="mt-8">
              <div class="card">
                <h2 class="text-xl font-semibold mb-4">Communication Layer</h2>
                <div id="communication-status" class="space-y-4">
                  <div class="animate-pulse">
                    <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Agents View -->
          <div id="agents-view" class="view-content hidden">
            <div class="card">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Agent Management</h2>
                <button class="btn btn-primary" id="add-agent-btn">
                  Add Agent
                </button>
              </div>
              
              <!-- Search and Filter -->
              <div class="mb-6 flex flex-wrap gap-4">
                <div class="flex-1 min-w-64">
                  <input type="text" id="agent-search" placeholder="Search agents..." class="form-input w-full">
                </div>
                <select id="agent-status-filter" class="form-select">
                  <option value="">All Status</option>
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="error">Error</option>
                </select>
                <select id="agent-type-filter" class="form-select">
                  <option value="">All Types</option>
                  <option value="DataProcessor">Data Processor</option>
                  <option value="Communicator">Communicator</option>
                  <option value="Discoverer">Discoverer</option>
                </select>
                <button class="btn btn-secondary" id="clear-filters-btn">Clear Filters</button>
              </div>

              <!-- Agents List -->
              <div id="agents-list" class="space-y-4">
                <div class="animate-pulse">
                  <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Communication View -->
          <div id="communication-view" class="view-content hidden">
            <div class="card">
              <h2 class="text-xl font-semibold mb-4">Communication Layer</h2>
              <div id="communication-details" class="space-y-4">
                <div class="animate-pulse">
                  <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Orchestration View -->
          <div id="orchestration-view" class="view-content hidden">
            <div class="card">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">Job Orchestration</h2>
                <button class="btn btn-primary" id="submit-job-btn">
                  Submit Job
                </button>
              </div>
              
              <!-- Job Queue -->
              <div id="job-queue" class="space-y-4">
                <div class="animate-pulse">
                  <div class="h-4 bg-gray-200 rounded w-full mb-2"></div>
                  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- System Logs View -->
          <div id="logs-view" class="view-content hidden">
            <div class="card">
              <div class="flex justify-between items-center mb-6">
                <h2 class="text-xl font-semibold">System Logs</h2>
                <div class="flex space-x-2">
                  <select id="log-level-filter" class="form-select">
                    <option value="">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                  <button class="btn btn-secondary" id="download-logs-btn">Download</button>
                  <button class="btn btn-secondary" id="clear-logs-btn">Clear</button>
                </div>
              </div>
              
              <!-- Logs Viewer -->
              <div id="logs-viewer" class="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
                <div class="animate-pulse">
                  <div class="h-4 bg-gray-700 rounded w-full mb-2"></div>
                  <div class="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Footer -->
        <footer class="bg-white border-t border-gray-200 mt-16">
          <div class="container mx-auto px-4 py-6">
            <div class="text-center text-gray-500">
              <p>&copy; 2024 AML-AIN. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>

      <!-- Modals -->
      <div id="modal-overlay" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50">
        <div class="flex items-center justify-center min-h-screen p-4">
          <div id="modal-content" class="bg-white rounded-lg shadow-xl max-w-md w-full">
            <!-- Modal content will be inserted here -->
          </div>
        </div>
      </div>
    `;
  }

  initializeDashboard() {
    // Initialize dashboard components
    this.updateAgentStatus();
    this.updateSystemMetrics();
    this.updateCommunicationStatus();
  }

  async updateAgentStatus() {
    const container = document.getElementById('agent-status');
    if (!container) return;

    try {
      // Simulate API call
      const agents = await this.fetchAgents();
      
      // Sanitize agent data to prevent XSS
      const sanitizedAgents = agents.map(agent => ({
        ...agent,
        name: this.escapeHtml(agent.name),
        type: this.escapeHtml(agent.type),
        status: this.escapeHtml(agent.status),
        health: this.escapeHtml(agent.health),
        lastSeen: this.escapeHtml(agent.lastSeen),
        capabilities: agent.capabilities.map(cap => this.escapeHtml(cap))
      }));
      
      container.innerHTML = sanitizedAgents.map(agent => `
        <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div class="flex items-center">
            <div class="w-3 h-3 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'} mr-3"></div>
            <div>
              <h3 class="font-medium">${agent.name}</h3>
              <p class="text-sm text-gray-500">${agent.type} • ${agent.capabilities.join(', ')}</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-sm font-medium">${agent.status}</div>
            <div class="text-xs text-gray-500">${agent.lastSeen}</div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      container.innerHTML = `
        <div class="text-center text-gray-500">
          <p>Failed to load agent status</p>
          <button class="btn btn-primary btn-sm mt-2" onclick="app.updateAgentStatus()">Retry</button>
        </div>
      `;
    }
  }

  async updateSystemMetrics() {
    const container = document.getElementById('system-metrics');
    if (!container) return;

    try {
      // Simulate API call
      const metrics = await this.fetchSystemMetrics();
      
      container.innerHTML = `
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">CPU Usage</span>
            <span class="text-sm font-medium">${metrics.cpu}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full" style="width: ${metrics.cpu}%"></div>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Memory Usage</span>
            <span class="text-sm font-medium">${metrics.memory}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div class="bg-primary h-2 rounded-full" style="width: ${metrics.memory}%"></div>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Active Agents</span>
            <span class="text-sm font-medium">${metrics.activeAgents}</span>
          </div>
          
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Messages/sec</span>
            <span class="text-sm font-medium">${metrics.messagesPerSecond}</span>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="text-center text-gray-500">
          <p>Failed to load system metrics</p>
          <button class="btn btn-primary btn-sm mt-2" onclick="app.updateSystemMetrics()">Retry</button>
        </div>
      `;
    }
  }

  async updateCommunicationStatus() {
    const container = document.getElementById('communication-status');
    if (!container) return;

    try {
      // Simulate API call
      const status = await this.fetchCommunicationStatus();
      
      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="p-4 border border-gray-200 rounded-lg">
            <h3 class="font-medium mb-2">Queue Status</h3>
            <div class="text-2xl font-bold text-green-600">${status.queues}</div>
            <p class="text-sm text-gray-500">Active Queues</p>
          </div>
          <div class="p-4 border border-gray-200 rounded-lg">
            <h3 class="font-medium mb-2">Connections</h3>
            <div class="text-2xl font-bold text-blue-600">${status.connections}</div>
            <p class="text-sm text-gray-500">Active Connections</p>
          </div>
          <div class="p-4 border border-gray-200 rounded-lg">
            <h3 class="font-medium mb-2">Pending Messages</h3>
            <div class="text-2xl font-bold text-orange-600">${status.pendingMessages}</div>
            <p class="text-sm text-gray-500">In Queue</p>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="text-center text-gray-500">
          <p>Failed to load communication status</p>
          <button class="btn btn-primary btn-sm mt-2" onclick="app.updateCommunicationStatus()">Retry</button>
        </div>
      `;
    }
  }

  async initializeAPI() {
    // Initialize API client
    this.api = {
      baseUrl: this.config.apiUrl,
      
      async request(endpoint, options = {}) {
        const url = `${this.api.baseUrl}${endpoint}`;
        const response = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...options.headers
          },
          ...options
        });
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        return response.json();
      }
    };
  }

  async initializeWebSocket() {
    try {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus('connected');
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus('disconnected');
        
        // Attempt to reconnect
        setTimeout(() => {
          this.initializeWebSocket();
        }, 5000);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('error');
      };
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  setupEventListeners() {
    // Store event listeners for cleanup
    this.eventListeners = [];
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      const listener = (e) => {
        const view = e.target.dataset.view;
        this.switchView(view);
      };
      item.addEventListener('click', listener);
      this.eventListeners.push({ element: item, event: 'click', listener });
    });

    // Agent management
    document.getElementById('add-agent-btn')?.addEventListener('click', () => {
      this.showAddAgentModal();
    });

    document.getElementById('agent-search')?.addEventListener('input', (e) => {
      this.filterAgents();
    });

    document.getElementById('agent-status-filter')?.addEventListener('change', () => {
      this.filterAgents();
    });

    document.getElementById('agent-type-filter')?.addEventListener('change', () => {
      this.filterAgents();
    });

    document.getElementById('clear-filters-btn')?.addEventListener('click', () => {
      this.clearAgentFilters();
    });

    // Job orchestration
    document.getElementById('submit-job-btn')?.addEventListener('click', () => {
      this.showSubmitJobModal();
    });

    // System logs
    document.getElementById('download-logs-btn')?.addEventListener('click', () => {
      this.downloadLogs();
    });

    document.getElementById('clear-logs-btn')?.addEventListener('click', () => {
      this.clearLogs();
    });

    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', () => {
      this.showSettingsModal();
    });

    // User menu
    document.getElementById('user-menu-btn')?.addEventListener('click', () => {
      this.showUserMenu();
    });
  }

  // Real API methods
  async fetchAgents() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/agents`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.agents || [];
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return [];
    }
  }

  async fetchSystemMetrics() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/metrics`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      return { cpu: 0, memory: 0, activeAgents: 0, messagesPerSecond: 0 };
    }
  }

  async fetchCommunicationStatus() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/communication/status`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch communication status:', error);
      return { queues: 0, connections: 0, pendingMessages: 0 };
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'metrics_update':
        this.updateSystemMetrics();
        break;
      case 'agent_update':
        this.updateAgentStatus();
        break;
      case 'communication_update':
        this.updateCommunicationStatus();
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  updateConnectionStatus(status) {
    const statusElement = document.querySelector('.status');
    if (!statusElement) return;

    const indicator = statusElement.querySelector('span');
    const text = statusElement.textContent;

    switch (status) {
      case 'connected':
        indicator.className = 'w-2 h-2 bg-green-500 rounded-full mr-2';
        statusElement.textContent = 'System Online';
        break;
      case 'disconnected':
        indicator.className = 'w-2 h-2 bg-yellow-500 rounded-full mr-2';
        statusElement.textContent = 'Reconnecting...';
        break;
      case 'error':
        indicator.className = 'w-2 h-2 bg-red-500 rounded-full mr-2';
        statusElement.textContent = 'Connection Error';
        break;
    }
  }

  // View management
  switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view-content').forEach(view => {
      view.classList.add('hidden');
    });

    // Show selected view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
      targetView.classList.remove('hidden');
    }

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    // Load view-specific content
    this.loadViewContent(viewName);
  }

  async loadViewContent(viewName) {
    switch (viewName) {
      case 'dashboard':
        this.updateAgentStatus();
        this.updateSystemMetrics();
        this.updateCommunicationStatus();
        break;
      case 'agents':
        this.loadAgentsView();
        break;
      case 'communication':
        this.loadCommunicationView();
        break;
      case 'orchestration':
        this.loadOrchestrationView();
        break;
      case 'logs':
        this.loadLogsView();
        break;
    }
  }

  // Agent management
  async loadAgentsView() {
    const container = document.getElementById('agents-list');
    if (!container) return;

    try {
      const agents = await this.fetchAgents();
      this.renderAgentsList(agents);
    } catch (error) {
      container.innerHTML = `
        <div class="text-center text-gray-500">
          <p>Failed to load agents</p>
          <button class="btn btn-primary btn-sm mt-2" onclick="app.loadAgentsView()">Retry</button>
        </div>
      `;
    }
  }

  renderAgentsList(agents) {
    const container = document.getElementById('agents-list');
    if (!container) return;

    // Sanitize agent data to prevent XSS
    const sanitizedAgents = agents.map(agent => ({
      ...agent,
      id: this.escapeHtml(agent.id),
      name: this.escapeHtml(agent.name),
      type: this.escapeHtml(agent.type),
      status: this.escapeHtml(agent.status),
      health: this.escapeHtml(agent.health),
      lastSeen: this.escapeHtml(agent.lastSeen),
      capabilities: agent.capabilities.map(cap => this.escapeHtml(cap))
    }));

    container.innerHTML = sanitizedAgents.map(agent => `
      <div class="flex items-center justify-between p-4 border border-gray-200 rounded-lg" data-agent-id="${agent.id}">
        <div class="flex items-center">
          <div class="w-3 h-3 rounded-full ${agent.status === 'online' ? 'bg-green-500' : 'bg-red-500'} mr-3"></div>
          <div>
            <h3 class="font-medium">${agent.name}</h3>
            <p class="text-sm text-gray-500">${agent.type} • ${agent.capabilities.join(', ')}</p>
            <p class="text-xs text-gray-400">Last seen: ${agent.lastSeen}</p>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <span class="px-2 py-1 text-xs rounded-full ${agent.health === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${agent.health}
          </span>
          <div class="dropdown">
            <button class="btn btn-secondary btn-sm dropdown-toggle">
              Actions
            </button>
            <div class="dropdown-menu">
              <button class="dropdown-item" onclick="app.agentAction('${agent.id}', 'start')">Start</button>
              <button class="dropdown-item" onclick="app.agentAction('${agent.id}', 'stop')">Stop</button>
              <button class="dropdown-item" onclick="app.agentAction('${agent.id}', 'restart')">Restart</button>
              <button class="dropdown-item" onclick="app.agentAction('${agent.id}', 'deregister')">Deregister</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  async agentAction(agentId, action) {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/agents/${agentId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      // Refresh agents list
      this.loadAgentsView();
      
      // Show success message
      this.showNotification(`Agent ${action} successful`, 'success');
    } catch (error) {
      console.error(`Failed to ${action} agent:`, error);
      this.showNotification(`Failed to ${action} agent`, 'error');
    }
  }

  filterAgents() {
    // Implementation for agent filtering
    console.log('Filtering agents...');
  }

  clearAgentFilters() {
    document.getElementById('agent-search').value = '';
    document.getElementById('agent-status-filter').value = '';
    document.getElementById('agent-type-filter').value = '';
    this.loadAgentsView();
  }

  // System logs
  async loadLogsView() {
    const container = document.getElementById('logs-viewer');
    if (!container) return;

    // Simulate logs
    const logs = [
      { timestamp: new Date().toISOString(), level: 'info', message: 'System initialized successfully' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'WebSocket connection established' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'Agent discovery service started' },
      { timestamp: new Date().toISOString(), level: 'info', message: 'Communication layer active' }
    ];

    // Sanitize log data to prevent XSS
    const sanitizedLogs = logs.map(log => ({
      ...log,
      level: this.escapeHtml(log.level),
      message: this.escapeHtml(log.message)
    }));

    container.innerHTML = sanitizedLogs.map(log => `
      <div class="log-entry">
        <span class="text-gray-400">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
        <span class="text-${log.level === 'error' ? 'red' : log.level === 'warn' ? 'yellow' : 'green'}-400">${log.level.toUpperCase()}</span>
        <span class="text-white">${log.message}</span>
      </div>
    `).join('');
  }

  downloadLogs() {
    // Implementation for downloading logs
    console.log('Downloading logs...');
    this.showNotification('Logs download started', 'info');
  }

  clearLogs() {
    const container = document.getElementById('logs-viewer');
    if (container) {
      container.innerHTML = '';
    }
    this.showNotification('Logs cleared', 'info');
  }

  // Modal management
  showModal(content) {
    const overlay = document.getElementById('modal-overlay');
    const modalContent = document.getElementById('modal-content');
    
    if (overlay && modalContent) {
      modalContent.innerHTML = content;
      overlay.classList.remove('hidden');
    }
  }

  hideModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
    }
  }

  showAddAgentModal() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Add New Agent</h3>
        <form id="add-agent-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Agent Name</label>
            <input type="text" name="name" class="form-input w-full" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Agent Type</label>
            <select name="type" class="form-select w-full" required>
              <option value="">Select Type</option>
              <option value="DataProcessor">Data Processor</option>
              <option value="Communicator">Communicator</option>
              <option value="Discoverer">Discoverer</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Capabilities</label>
            <input type="text" name="capabilities" class="form-input w-full" placeholder="data-processing, ml-training">
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" class="btn btn-secondary" onclick="app.hideModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Agent</button>
          </div>
        </form>
      </div>
    `;
    this.showModal(content);
  }

  showSubmitJobModal() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Submit New Job</h3>
        <form id="submit-job-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Job Name</label>
            <input type="text" name="name" class="form-input w-full" required>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
            <select name="type" class="form-select w-full" required>
              <option value="">Select Type</option>
              <option value="data-processing">Data Processing</option>
              <option value="ml-training">ML Training</option>
              <option value="inference">Inference</option>
            </select>
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">Parameters (JSON)</label>
            <textarea name="parameters" class="form-textarea w-full h-24" placeholder='{"param1": "value1"}'></textarea>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" class="btn btn-secondary" onclick="app.hideModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Submit Job</button>
          </div>
        </form>
      </div>
    `;
    this.showModal(content);
  }

  showSettingsModal() {
    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">Settings</h3>
        <form id="settings-form">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">API Endpoint</label>
            <input type="text" name="apiUrl" value="${this.config.apiUrl}" class="form-input w-full">
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 mb-2">WebSocket URL</label>
            <input type="text" name="wsUrl" value="${this.config.wsUrl}" class="form-input w-full">
          </div>
          <div class="mb-4">
            <label class="flex items-center">
              <input type="checkbox" name="debug" ${this.config.debug ? 'checked' : ''} class="form-checkbox">
              <span class="ml-2 text-sm text-gray-700">Debug Mode</span>
            </label>
          </div>
          <div class="mb-4">
            <label class="flex items-center">
              <input type="checkbox" name="darkMode" class="form-checkbox">
              <span class="ml-2 text-sm text-gray-700">Dark Mode</span>
            </label>
          </div>
          <div class="flex justify-end space-x-2">
            <button type="button" class="btn btn-secondary" onclick="app.hideModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Settings</button>
          </div>
        </form>
      </div>
    `;
    this.showModal(content);
  }

  showUserMenu() {
    // Sanitize user data to prevent XSS
    const sanitizedUser = {
      name: this.escapeHtml(this.currentUser.name),
      email: this.escapeHtml(this.currentUser.email),
      role: this.escapeHtml(this.currentUser.role)
    };

    const content = `
      <div class="p-6">
        <h3 class="text-lg font-semibold mb-4">User Profile</h3>
        <div class="mb-4">
          <p class="text-sm text-gray-600">Name: ${sanitizedUser.name}</p>
          <p class="text-sm text-gray-600">Email: ${sanitizedUser.email}</p>
          <p class="text-sm text-gray-600">Role: ${sanitizedUser.role}</p>
        </div>
        <div class="flex justify-end space-x-2">
          <button class="btn btn-secondary" onclick="app.hideModal()">Close</button>
          <button class="btn btn-primary" onclick="app.logout()">Logout</button>
        </div>
      </div>
    `;
    this.showModal(content);
  }

  // Notifications
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
      type === 'error' ? 'bg-red-500 text-white' :
      type === 'success' ? 'bg-green-500 text-white' :
      'bg-blue-500 text-white'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }

  // Utility methods
  logout() {
    // Implementation for logout
    console.log('Logging out...');
    this.hideModal();
    this.showNotification('Logged out successfully', 'info');
  }

  openSettings() {
    this.showSettingsModal();
  }

  onReady() {
    console.log('AML-AIN Frontend is ready!');
    
    // Show welcome notification
    this.showNotification('AML-AIN System Online', 'success');
  }

  handleError(error) {
    console.error('Application error:', error);
    this.showNotification('An error occurred', 'error');
  }

  /**
   * Escape HTML to prevent XSS attacks
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Safely set innerHTML with sanitized content
   * @param {Element} element - Target element
   * @param {string} content - Content to set
   */
  safeSetInnerHTML(element, content) {
    if (element && content) {
      element.innerHTML = content;
    }
  }

  /**
   * Clean up event listeners to prevent memory leaks
   */
  cleanup() {
    if (this.eventListeners) {
      this.eventListeners.forEach(({ element, event, listener }) => {
        element.removeEventListener(event, listener);
      });
      this.eventListeners = [];
    }
    
    // Close WebSocket connection
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Initialize the application
const app = new AMLApp();

// Start the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Make app globally available for debugging
window.app = app; 