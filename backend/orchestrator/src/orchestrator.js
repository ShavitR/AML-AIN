const { v4: uuidv4 } = require('uuid');

// In-memory stores for demo
const jobs = [];
const tasks = [];
const agents = [
  { id: 'agent-1', name: 'Agent 1', healthy: true, load: 0.2, resources: { cpu: 4, memory: 8192, disk: 100, gpu: 0 } },
  { id: 'agent-2', name: 'Agent 2', healthy: true, load: 0.1, resources: { cpu: 8, memory: 16384, disk: 200, gpu: 1 } },
];
const assignments = [];
const metrics = { jobs: 0, tasks: 0, failed: 0, completed: 0 };
let config = { scheduling: { type: 'FIFO' }, maxRetries: 3 };

/**
 * Submit a new job to the orchestrator
 * @param {Object} jobSpec
 * @returns {Job}
 */
function submitJob(jobSpec) {
  // TODO: Validate jobSpec
  const job = {
    id: uuidv4(),
    name: jobSpec.name,
    owner: jobSpec.owner,
    parameters: jobSpec.parameters || {},
    tasks: [],
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  jobs.push(job);
  metrics.jobs++;
  // Decompose job into tasks
  job.tasks = decomposeJob(job);
  // Resolve dependencies
  resolveDependencies(job.tasks);
  // Schedule tasks
  scheduleTasks(job.tasks);
  return job;
}

/**
 * Decompose a job into tasks and subtasks
 * @param {Job} job
 * @returns {Task[]}
 */
function decomposeJob(job) {
  // For now, create a single task as a placeholder
  const task = {
    id: uuidv4(),
    jobId: job.id,
    name: `${job.name}-task-1`,
    type: 'generic',
    input: {},
    dependencies: [],
    status: 'pending',
    assignedAgentId: null,
    resources: { cpu: 1, memory: 512, disk: 0, gpu: 0 },
    priority: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    retries: 0,
  };
  tasks.push(task);
  metrics.tasks++;
  return [task];
}

/**
 * Resolve dependencies between tasks using topological sort
 * @param {Task[]} tasks
 * @returns {Task[]}
 */
function resolveDependencies(tasks) {
  // Simple check for cycles (no real dependencies yet)
  // TODO: Implement real topological sort and cycle detection
  return tasks;
}

/**
 * Select agents for tasks using round-robin and health check
 * @param {Task[]} tasks
 * @returns {AgentAssignment[]}
 */
function selectAgents(tasks) {
  let agentIdx = 0;
  return tasks.map(task => {
    // Find next healthy agent
    let agent = null;
    for (let i = 0; i < agents.length; i++) {
      const candidate = agents[(agentIdx + i) % agents.length];
      if (candidate.healthy) {
        agent = candidate;
        agentIdx = (agentIdx + i + 1) % agents.length;
        break;
      }
    }
    return {
      agentId: agent ? agent.id : null,
      taskId: task.id,
      assignedAt: new Date(),
      status: 'assigned',
    };
  });
}

/**
 * Schedule tasks for execution (FIFO or priority)
 * @param {Task[]} tasks
 */
function scheduleTasks(tasks) {
  // Sort by priority if needed
  if (config.scheduling.type === 'priority') {
    tasks.sort((a, b) => b.priority - a.priority);
  }
  // FIFO by default
  const assignments = selectAgents(tasks);
  assignments.forEach(assign => {
    assignTaskToAgent(assign.agentId, assign.taskId);
  });
}

/**
 * Assign a task to an agent (simulate dispatch)
 * @param {string} agentId
 * @param {string} taskId
 */
function assignTaskToAgent(agentId, taskId) {
  assignments.push({ agentId, taskId, assignedAt: new Date(), status: 'assigned' });
  // Simulate task running and completion
  setTimeout(() => {
    completeTask(taskId, agentId);
  }, 1000 + Math.random() * 2000);
}

/**
 * Complete a task and update metrics
 * @param {string} taskId
 * @param {string} agentId
 */
function completeTask(taskId, agentId) {
  const task = tasks.find(t => t.id === taskId);
  if (task) {
    task.status = 'completed';
    task.assignedAgentId = agentId;
    task.updatedAt = new Date();
    metrics.completed++;
    log(`Task completed: ${taskId} by ${agentId}`);
  }
}

/**
 * Monitor task and agent status (aggregate status)
 */
function monitor() {
  // Aggregate job/task/agent status
  return {
    jobs: jobs.length,
    tasks: tasks.length,
    agents: agents.length,
    completed: metrics.completed,
    failed: metrics.failed,
  };
}

/**
 * Handle task/agent failures and retry up to maxRetries
 */
function handleFailures() {
  tasks.forEach(task => {
    if (task.status === 'failed' && task.retries < config.maxRetries) {
      task.retries++;
      task.status = 'pending';
      scheduleTasks([task]);
      log(`Retrying task ${task.id}, attempt ${task.retries}`);
    } else if (task.status === 'failed') {
      metrics.failed++;
      log(`Task ${task.id} permanently failed`);
    }
  });
}

/**
 * Collect orchestration metrics
 */
function collectMetrics() {
  return { ...metrics };
}

/**
 * Load and validate orchestration configuration from JSON
 * @param {Object} newConfig
 */
function loadConfig(newConfig) {
  config = { ...config, ...newConfig };
  log('Configuration updated');
}

/**
 * Log orchestration events (structured)
 * @param {string} message
 */
function log(message) {
  console.log(`[Orchestrator] ${new Date().toISOString()} - ${message}`);
}

module.exports = {
  submitJob,
  decomposeJob,
  resolveDependencies,
  selectAgents,
  scheduleTasks,
  assignTaskToAgent,
  monitor,
  handleFailures,
  collectMetrics,
  loadConfig,
  log,
  jobs,
  tasks,
  agents,
  assignments,
  metrics,
}; 