// Global teardown for Jest tests

module.exports = async function globalTeardown() {
  // Cleanup global test environment
  // e.g., close database connections, cleanup files, etc.

  console.log('Global teardown completed');
};
