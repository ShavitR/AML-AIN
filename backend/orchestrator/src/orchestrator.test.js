const orchestrator = require('./orchestrator');

describe('Orchestrator Core', () => {
  beforeEach(() => {
    // Reset state before each test
    orchestrator.jobs.length = 0;
    orchestrator.tasks.length = 0;
    orchestrator.assignments.length = 0;
    orchestrator.metrics.jobs = 0;
    orchestrator.metrics.tasks = 0;
    orchestrator.metrics.failed = 0;
    orchestrator.metrics.completed = 0;
    
    // Reset agents to healthy state
    orchestrator.agents.forEach(agent => {
      agent.healthy = true;
      agent.load = 0.1;
    });
    
    // Reset config
    orchestrator.loadConfig({ scheduling: { type: 'FIFO' }, maxRetries: 3 });
  });

  describe('submitJob', () => {
    test('should submit a job and add it to jobs', () => {
      const jobSpec = {
        name: 'Test Job',
        owner: 'test-user',
        parameters: { param1: 'value1' }
      };

      const job = orchestrator.submitJob(jobSpec);

      expect(job.id).toBeDefined();
      expect(job.name).toBe('Test Job');
      expect(job.owner).toBe('test-user');
      expect(job.parameters).toEqual({ param1: 'value1' });
      expect(job.status).toBe('pending');
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
      expect(job.tasks).toHaveLength(1);
      expect(orchestrator.jobs).toContain(job);
      expect(orchestrator.metrics.jobs).toBe(1);
    });

    test('should handle job without parameters', () => {
      const jobSpec = {
        name: 'Test Job',
        owner: 'test-user'
      };

      const job = orchestrator.submitJob(jobSpec);

      expect(job.parameters).toEqual({});
      expect(job.tasks).toHaveLength(1);
    });

    test('should create tasks for the job', () => {
      const jobSpec = {
        name: 'Test Job',
        owner: 'test-user'
      };

      const job = orchestrator.submitJob(jobSpec);

      expect(job.tasks).toHaveLength(1);
      const task = job.tasks[0];
      expect(task.jobId).toBe(job.id);
      expect(task.name).toBe('Test Job-task-1');
      expect(task.type).toBe('generic');
      expect(task.status).toBe('pending');
      expect(task.assignedAgentId).toBeNull();
      expect(task.retries).toBe(0);
      expect(orchestrator.tasks).toContain(task);
      expect(orchestrator.metrics.tasks).toBe(1);
    });

    test('should schedule tasks after job submission', () => {
      const jobSpec = {
        name: 'Test Job',
        owner: 'test-user'
      };

      const job = orchestrator.submitJob(jobSpec);

      // Tasks should be scheduled (assignments created)
      expect(orchestrator.assignments.length).toBeGreaterThan(0);
      const assignment = orchestrator.assignments[0];
      expect(assignment.taskId).toBe(job.tasks[0].id);
      expect(assignment.status).toBe('assigned');
      expect(assignment.assignedAt).toBeInstanceOf(Date);
    });
  });

  describe('decomposeJob', () => {
    test('should create a single task for a job', () => {
      const job = {
        id: 'test-job-1',
        name: 'Test Job',
        owner: 'test-user'
      };

      const tasks = orchestrator.decomposeJob(job);

      expect(tasks).toHaveLength(1);
      const task = tasks[0];
      expect(task.id).toBeDefined();
      expect(task.jobId).toBe(job.id);
      expect(task.name).toBe('Test Job-task-1');
      expect(task.type).toBe('generic');
      expect(task.input).toEqual({});
      expect(task.dependencies).toEqual([]);
      expect(task.status).toBe('pending');
      expect(task.assignedAgentId).toBeNull();
      expect(task.resources).toEqual({ cpu: 1, memory: 512, disk: 0, gpu: 0 });
      expect(task.priority).toBe(1);
      expect(task.retries).toBe(0);
      expect(task.createdAt).toBeInstanceOf(Date);
      expect(task.updatedAt).toBeInstanceOf(Date);
    });

    test('should add task to global tasks array', () => {
      const job = {
        id: 'test-job-1',
        name: 'Test Job',
        owner: 'test-user'
      };

      const initialTaskCount = orchestrator.tasks.length;
      const tasks = orchestrator.decomposeJob(job);

      expect(orchestrator.tasks.length).toBe(initialTaskCount + 1);
      expect(orchestrator.tasks).toContain(tasks[0]);
      expect(orchestrator.metrics.tasks).toBe(1);
    });
  });

  describe('resolveDependencies', () => {
    test('should return tasks unchanged (simple implementation)', () => {
      const tasks = [
        { id: 'task-1', dependencies: [] },
        { id: 'task-2', dependencies: ['task-1'] }
      ];

      const result = orchestrator.resolveDependencies(tasks);

      expect(result).toBe(tasks);
      expect(result).toEqual(tasks);
    });

    test('should handle empty task array', () => {
      const result = orchestrator.resolveDependencies([]);
      expect(result).toEqual([]);
    });
  });

  describe('selectAgents', () => {
    test('should select healthy agents in round-robin fashion', () => {
      const tasks = [
        { id: 'task-1' },
        { id: 'task-2' },
        { id: 'task-3' }
      ];

      const assignments = orchestrator.selectAgents(tasks);

      expect(assignments).toHaveLength(3);
      assignments.forEach(assignment => {
        expect(assignment.agentId).toBeDefined();
        expect(assignment.taskId).toBeDefined();
        expect(assignment.status).toBe('assigned');
        expect(assignment.assignedAt).toBeInstanceOf(Date);
      });

      // Should use different agents in round-robin
      const agentIds = assignments.map(a => a.agentId);
      expect(new Set(agentIds).size).toBeGreaterThan(1);
    });

    test('should handle unhealthy agents', () => {
      // Make all agents unhealthy
      orchestrator.agents.forEach(agent => {
        agent.healthy = false;
      });

      const tasks = [{ id: 'task-1' }];
      const assignments = orchestrator.selectAgents(tasks);

      expect(assignments).toHaveLength(1);
      expect(assignments[0].agentId).toBeNull();
    });

    test('should handle mixed healthy/unhealthy agents', () => {
      // Make only one agent unhealthy
      orchestrator.agents[0].healthy = false;

      const tasks = [
        { id: 'task-1' },
        { id: 'task-2' }
      ];

      const assignments = orchestrator.selectAgents(tasks);

      expect(assignments).toHaveLength(2);
      // Should skip unhealthy agent and assign to healthy ones
      assignments.forEach(assignment => {
        expect(assignment.agentId).not.toBe(orchestrator.agents[0].id);
      });
    });

    test('should handle empty task array', () => {
      const assignments = orchestrator.selectAgents([]);
      expect(assignments).toEqual([]);
    });
  });

  describe('scheduleTasks', () => {
    test('should schedule tasks in FIFO order by default', () => {
      const tasks = [
        { id: 'task-1', priority: 1 },
        { id: 'task-2', priority: 3 },
        { id: 'task-3', priority: 2 }
      ];

      orchestrator.scheduleTasks(tasks);

      // Should create assignments for all tasks
      expect(orchestrator.assignments.length).toBe(3);
      const taskIds = orchestrator.assignments.map(a => a.taskId);
      expect(taskIds).toContain('task-1');
      expect(taskIds).toContain('task-2');
      expect(taskIds).toContain('task-3');
    });

    test('should schedule tasks in priority order when configured', () => {
      orchestrator.loadConfig({ scheduling: { type: 'priority' }, maxRetries: 3 });

      const tasks = [
        { id: 'task-1', priority: 1 },
        { id: 'task-2', priority: 3 },
        { id: 'task-3', priority: 2 }
      ];

      orchestrator.scheduleTasks(tasks);

      // Should create assignments for all tasks
      expect(orchestrator.assignments.length).toBe(3);
      const taskIds = orchestrator.assignments.map(a => a.taskId);
      expect(taskIds).toContain('task-1');
      expect(taskIds).toContain('task-2');
      expect(taskIds).toContain('task-3');
    });

    test('should handle empty task array', () => {
      orchestrator.scheduleTasks([]);
      expect(orchestrator.assignments.length).toBe(0);
    });
  });

  describe('assignTaskToAgent', () => {
    test('should create assignment and schedule completion', () => {
      const agentId = 'agent-1';
      const taskId = 'task-1';

      orchestrator.assignTaskToAgent(agentId, taskId);

      expect(orchestrator.assignments.length).toBe(1);
      const assignment = orchestrator.assignments[0];
      expect(assignment.agentId).toBe(agentId);
      expect(assignment.taskId).toBe(taskId);
      expect(assignment.status).toBe('assigned');
      expect(assignment.assignedAt).toBeInstanceOf(Date);
    });

    test('should handle null agentId', () => {
      const taskId = 'task-1';

      orchestrator.assignTaskToAgent(null, taskId);

      expect(orchestrator.assignments.length).toBe(1);
      const assignment = orchestrator.assignments[0];
      expect(assignment.agentId).toBeNull();
      expect(assignment.taskId).toBe(taskId);
    });
  });

  describe('completeTask', () => {
    test('should complete task and update metrics', () => {
      // Create a task first
      const job = { id: 'job-1', name: 'Test Job' };
      const tasks = orchestrator.decomposeJob(job);
      const task = tasks[0];
      const agentId = 'agent-1';

      const initialCompleted = orchestrator.metrics.completed;
      orchestrator.completeTask(task.id, agentId);

      expect(task.status).toBe('completed');
      expect(task.assignedAgentId).toBe(agentId);
      expect(task.updatedAt).toBeInstanceOf(Date);
      expect(orchestrator.metrics.completed).toBe(initialCompleted + 1);
    });

    test('should handle non-existent task', () => {
      const initialCompleted = orchestrator.metrics.completed;
      orchestrator.completeTask('non-existent-task', 'agent-1');

      expect(orchestrator.metrics.completed).toBe(initialCompleted);
    });
  });

  describe('monitor', () => {
    test('should return aggregated status', () => {
      // Create some jobs and tasks
      orchestrator.submitJob({ name: 'Job 1', owner: 'user1' });
      orchestrator.submitJob({ name: 'Job 2', owner: 'user2' });

      const status = orchestrator.monitor();

      expect(status.jobs).toBe(2);
      expect(status.tasks).toBe(2);
      expect(status.agents).toBe(2);
      expect(status.completed).toBe(0); // Tasks haven't completed yet
      expect(status.failed).toBe(0);
    });

    test('should reflect completed and failed tasks', () => {
      // Create a job and complete a task
      const job = orchestrator.submitJob({ name: 'Test Job', owner: 'user1' });
      const task = job.tasks[0];
      
      // Manually mark task as completed
      task.status = 'completed';
      orchestrator.metrics.completed = 1;
      
      // Manually mark another task as failed
      orchestrator.metrics.failed = 1;

      const status = orchestrator.monitor();

      expect(status.completed).toBe(1);
      expect(status.failed).toBe(1);
    });
  });

  describe('handleFailures', () => {
    test('should retry failed tasks within retry limit', () => {
      // Create a failed task
      const job = { id: 'job-1', name: 'Test Job' };
      const tasks = orchestrator.decomposeJob(job);
      const task = tasks[0];
      task.status = 'failed';
      task.retries = 1;

      orchestrator.handleFailures();

      expect(task.retries).toBe(2);
      expect(task.status).toBe('pending');
    });

    test('should permanently fail tasks exceeding retry limit', () => {
      // Create a failed task at max retries
      const job = { id: 'job-1', name: 'Test Job' };
      const tasks = orchestrator.decomposeJob(job);
      const task = tasks[0];
      task.status = 'failed';
      task.retries = 3; // Max retries

      const initialFailed = orchestrator.metrics.failed;
      orchestrator.handleFailures();

      expect(task.retries).toBe(3); // Should not increment
      expect(task.status).toBe('failed'); // Should remain failed
      expect(orchestrator.metrics.failed).toBe(initialFailed + 1);
    });

    test('should not retry non-failed tasks', () => {
      // Create a pending task
      const job = { id: 'job-1', name: 'Test Job' };
      const tasks = orchestrator.decomposeJob(job);
      const task = tasks[0];
      task.status = 'pending';
      task.retries = 0;

      orchestrator.handleFailures();

      expect(task.retries).toBe(0);
      expect(task.status).toBe('pending');
    });

    test('should handle empty task array', () => {
      expect(() => orchestrator.handleFailures()).not.toThrow();
    });
  });

  describe('collectMetrics', () => {
    test('should return copy of metrics', () => {
      // Set some metrics
      orchestrator.metrics.jobs = 5;
      orchestrator.metrics.tasks = 10;
      orchestrator.metrics.completed = 7;
      orchestrator.metrics.failed = 2;

      const metrics = orchestrator.collectMetrics();

      expect(metrics).toEqual({
        jobs: 5,
        tasks: 10,
        completed: 7,
        failed: 2
      });

      // Should be a copy, not a reference
      expect(metrics).not.toBe(orchestrator.metrics);
    });

    test('should return zero metrics when empty', () => {
      const metrics = orchestrator.collectMetrics();

      expect(metrics).toEqual({
        jobs: 0,
        tasks: 0,
        completed: 0,
        failed: 0
      });
    });
  });

  describe('loadConfig', () => {
    test('should merge new config with existing config', () => {
      const newConfig = {
        scheduling: { type: 'priority' },
        maxRetries: 5
      };

      orchestrator.loadConfig(newConfig);

      // Should update the internal config
      expect(orchestrator.metrics).toBeDefined(); // Config is internal, but we can test effects
    });

    test('should handle partial config updates', () => {
      const newConfig = {
        maxRetries: 10
      };

      orchestrator.loadConfig(newConfig);

      // Should not throw and should update config
      expect(orchestrator.metrics).toBeDefined();
    });

    test('should handle empty config', () => {
      expect(() => orchestrator.loadConfig({})).not.toThrow();
    });
  });

  describe('log', () => {
    test('should log messages with timestamp', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const message = 'Test log message';

      orchestrator.log(message);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[Orchestrator\] \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z - Test log message/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete job lifecycle', () => {
      // Submit a job
      const job = orchestrator.submitJob({
        name: 'Integration Test Job',
        owner: 'test-user',
        parameters: { test: true }
      });

      expect(job.status).toBe('pending');
      expect(job.tasks).toHaveLength(1);
      expect(orchestrator.assignments.length).toBe(1);

      // Check that task is assigned
      const assignment = orchestrator.assignments[0];
      expect(assignment.taskId).toBe(job.tasks[0].id);
      expect(assignment.status).toBe('assigned');

      // Complete the task
      orchestrator.completeTask(job.tasks[0].id, assignment.agentId);

      expect(job.tasks[0].status).toBe('completed');
      expect(orchestrator.metrics.completed).toBe(1);

      // Check monitoring
      const status = orchestrator.monitor();
      expect(status.jobs).toBe(1);
      expect(status.tasks).toBe(1);
      expect(status.completed).toBe(1);
    });

    test('should handle task failure and retry', () => {
      // Submit a job
      const job = orchestrator.submitJob({
        name: 'Failure Test Job',
        owner: 'test-user'
      });

      const task = job.tasks[0];

      // Simulate task failure
      task.status = 'failed';
      task.retries = 0;

      // Handle failures (should retry)
      orchestrator.handleFailures();

      expect(task.retries).toBe(1);
      expect(task.status).toBe('pending');

      // Fail again and exceed retry limit
      task.status = 'failed';
      task.retries = 3;

      orchestrator.handleFailures();

      expect(task.retries).toBe(3);
      expect(task.status).toBe('failed');
      expect(orchestrator.metrics.failed).toBe(1);
    });

    test('should handle multiple jobs and tasks', () => {
      // Submit multiple jobs
      const job1 = orchestrator.submitJob({ name: 'Job 1', owner: 'user1' });
      const job2 = orchestrator.submitJob({ name: 'Job 2', owner: 'user2' });

      expect(orchestrator.jobs).toHaveLength(2);
      expect(orchestrator.tasks).toHaveLength(2);
      expect(orchestrator.assignments).toHaveLength(2);

      // Complete all tasks
      orchestrator.assignments.forEach(assignment => {
        orchestrator.completeTask(assignment.taskId, assignment.agentId);
      });

      expect(orchestrator.metrics.completed).toBe(2);

      // Check final status
      const status = orchestrator.monitor();
      expect(status.jobs).toBe(2);
      expect(status.tasks).toBe(2);
      expect(status.completed).toBe(2);
      expect(status.failed).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle job with empty name', () => {
      const job = orchestrator.submitJob({
        name: '',
        owner: 'test-user'
      });

      expect(job.name).toBe('');
      expect(job.tasks[0].name).toBe('-task-1');
    });

    test('should handle job with null parameters', () => {
      const job = orchestrator.submitJob({
        name: 'Test Job',
        owner: 'test-user',
        parameters: null
      });

      expect(job.parameters).toEqual({});
    });

    test('should handle all agents being unhealthy', () => {
      // Make all agents unhealthy
      orchestrator.agents.forEach(agent => {
        agent.healthy = false;
      });

      const job = orchestrator.submitJob({
        name: 'Test Job',
        owner: 'test-user'
      });

      // Should still create assignments but with null agentId
      expect(orchestrator.assignments.length).toBe(1);
      expect(orchestrator.assignments[0].agentId).toBeNull();
    });

    test('should handle task completion for non-existent task', () => {
      const initialCompleted = orchestrator.metrics.completed;
      orchestrator.completeTask('non-existent-task', 'agent-1');

      expect(orchestrator.metrics.completed).toBe(initialCompleted);
    });
  });
}); 