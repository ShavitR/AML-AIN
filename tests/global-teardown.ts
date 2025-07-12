// Global teardown for Jest tests

export default async function globalTeardown(): Promise<void> {
  // Cleanup global test environment
  // e.g., close database connections, cleanup files, etc.

  console.log('Global teardown completed');
}
