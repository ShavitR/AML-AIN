/**
 * @typedef {Object} Task
 * @property {string} id
 * @property {string} jobId
 * @property {string} name
 * @property {string} type
 * @property {Object} input
 * @property {string[]} dependencies
 * @property {string} status // pending, running, completed, failed, cancelled
 * @property {string} assignedAgentId
 * @property {ResourceRequest} resources
 * @property {number} priority
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {Object} Subtask
 * @property {string} id
 * @property {string} parentTaskId
 * @property {string} name
 * @property {Object} input
 * @property {string[]} dependencies
 * @property {string} status
 * @property {string} assignedAgentId
 * @property {ResourceRequest} resources
 * @property {number} priority
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {Object} Job
 * @property {string} id
 * @property {string} name
 * @property {string} owner
 * @property {Object} parameters
 * @property {Task[]} tasks
 * @property {string} status // pending, running, completed, failed, cancelled
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

/**
 * @typedef {Object} AgentAssignment
 * @property {string} agentId
 * @property {string} taskId
 * @property {Date} assignedAt
 * @property {string} status // assigned, running, completed, failed
 */

/**
 * @typedef {Object} Dependency
 * @property {string} fromTaskId
 * @property {string} toTaskId
 * @property {string} type // hard, soft, conditional
 */

/**
 * @typedef {Object} ResourceRequest
 * @property {number} cpu
 * @property {number} memory
 * @property {number} disk
 * @property {number} gpu
 */

/**
 * @typedef {Object} SchedulingPolicy
 * @property {string} type // FIFO, priority, round-robin, fair, deadline
 * @property {Object} options
 */

/**
 * @typedef {Object} OrchestrationStatus
 * @property {string} jobId
 * @property {string} status
 * @property {string[]} activeTaskIds
 * @property {string[]} completedTaskIds
 * @property {string[]} failedTaskIds
 * @property {Date} updatedAt
 */ 