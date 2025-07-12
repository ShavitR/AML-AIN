// AML-AIN Frontend Application
// Entry point for the frontend application

console.log('AML-AIN Frontend Application Starting...');

// Import styles
import './styles/base.css';

// Main application class
class AMLApp {
  constructor() {
    this.initialized = false;
    this.config = {
      apiUrl: 'http://localhost:3001',
      wsUrl: 'ws://localhost:3001',
      debug: true
    };
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
                <button class="btn btn-secondary btn-sm" id="settings-btn">
                  Settings
                </button>
              </div>
            </div>
          </div>
        </header>

        <!-- Main Content -->
        <main class="container mx-auto px-4 py-8">
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
      
      container.innerHTML = agents.map(agent => `
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
            <div class="bg-secondary h-2 rounded-full" style="width: ${metrics.memory}%"></div>
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
      const commStatus = await this.fetchCommunicationStatus();
      
      container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="text-center p-4 border border-gray-200 rounded-lg">
            <div class="text-2xl font-bold text-primary">${commStatus.queues}</div>
            <div class="text-sm text-gray-600">Active Queues</div>
          </div>
          <div class="text-center p-4 border border-gray-200 rounded-lg">
            <div class="text-2xl font-bold text-success">${commStatus.connections}</div>
            <div class="text-sm text-gray-600">WebSocket Connections</div>
          </div>
          <div class="text-center p-4 border border-gray-200 rounded-lg">
            <div class="text-2xl font-bold text-warning">${commStatus.pendingMessages}</div>
            <div class="text-sm text-gray-600">Pending Messages</div>
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
        const url = `${this.baseUrl}${endpoint}`;
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
    // Initialize WebSocket connection
    try {
      this.ws = new WebSocket(this.config.wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus('connected');
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleWebSocketMessage(data);
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus('disconnected');
        // Attempt to reconnect
        setTimeout(() => this.initializeWebSocket(), 5000);
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
    // Setup global event listeners
    document.addEventListener('DOMContentLoaded', () => {
      console.log('DOM loaded');
    });

    // Setup button event listeners
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }
  }

  // Real API methods
  async fetchAgents() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/agents`);
      const data = await response.json();
      return data.agents;
    } catch (error) {
      console.error('Failed to fetch agents:', error);
      return [];
    }
  }

  async fetchSystemMetrics() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/metrics`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      return {
        cpu: 0,
        memory: 0,
        activeAgents: 0,
        messagesPerSecond: 0
      };
    }
  }

  async fetchCommunicationStatus() {
    try {
      const response = await fetch(`${this.config.apiUrl}/api/communication/status`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch communication status:', error);
      return {
        queues: 0,
        connections: 0,
        pendingMessages: 0
      };
    }
  }

  handleWebSocketMessage(data) {
    console.log('WebSocket message received:', data);
    
    // Handle different message types
    switch (data.type) {
      case 'agent_status_update':
        this.updateAgentStatus();
        break;
      case 'system_metrics_update':
        this.updateSystemMetrics();
        break;
      case 'communication_status_update':
        this.updateCommunicationStatus();
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  updateConnectionStatus(status) {
    const statusElement = document.querySelector('.status');
    if (statusElement) {
      statusElement.className = `status status-${status === 'connected' ? 'online' : 'offline'}`;
      statusElement.innerHTML = `
        <span class="w-2 h-2 ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'} rounded-full mr-2"></span>
        System ${status === 'connected' ? 'Online' : 'Offline'}
      `;
    }
  }

  openSettings() {
    console.log('Opening settings...');
    // Implement settings modal
    alert('Settings functionality coming soon!');
  }

  onReady() {
    console.log('AML-AIN Frontend is ready!');
    
    // Start periodic updates
    setInterval(() => {
      this.updateSystemMetrics();
    }, 30000); // Update every 30 seconds
    
    setInterval(() => {
      this.updateAgentStatus();
    }, 60000); // Update every minute
  }

  handleError(error) {
    console.error('Application error:', error);
    
    // Show error notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-error text-white p-4 rounded-lg shadow-lg z-50';
    notification.innerHTML = `
      <div class="flex items-center">
        <span class="mr-2">⚠️</span>
        <span>An error occurred: ${error.message}</span>
        <button class="ml-4 text-white" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Create app instance
  window.app = new AMLApp();
  
  // Initialize the application
  window.app.init();
});

// Export for module usage
export default AMLApp; 