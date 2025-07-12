// Global setup for Jest tests

module.exports = async function globalSetup() {
  // Setup global test environment
  process.env.NODE_ENV = 'test';

  // Add any global setup logic here
  // e.g., database setup, mock services, etc.

  console.log('Global setup completed');
};
