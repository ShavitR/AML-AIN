// Global setup for Jest tests

export default async function globalSetup(): Promise<void> {
  // Setup global test environment
  process.env.NODE_ENV = 'test';

  // Add any global setup logic here
  // e.g., database setup, mock services, etc.

  console.log('Global setup completed');
}
