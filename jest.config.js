module.exports = {
  // Test environment
  testEnvironment: 'node',

  // File extensions to look for
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],

  // Test file patterns
  testMatch: ['<rootDir>/**/__tests__/**/*.(js|jsx|ts|tsx)', '<rootDir>/**/*.(test|spec).(js|jsx|ts|tsx)'],

  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
  },

  // TypeScript configuration
  preset: 'ts-jest',

  // Module name mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/backend/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@utils/(.*)$': '<rootDir>/backend/utils/$1',
    '^@models/(.*)$': '<rootDir>/backend/models/$1',
    '^@services/(.*)$': '<rootDir>/backend/services/$1',
    '^@controllers/(.*)$': '<rootDir>/backend/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/backend/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/backend/routes/$1',
    '^@types/(.*)$': '<rootDir>/backend/types/$1',
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/jest.setup.ts'],

  // Test timeout
  testTimeout: 30000,

  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'backend/**/*.{js,jsx,ts,tsx}',
    '!backend/**/*.d.ts',
    '!backend/**/*.test.{js,jsx,ts,tsx}',
    '!backend/**/*.spec.{js,jsx,ts,tsx}',
    '!backend/**/__tests__/**',
    '!backend/**/node_modules/**',
    '!backend/**/dist/**',
    '!backend/**/build/**',
    '!backend/**/coverage/**',
    '!backend/**/*.config.{js,ts}',
    '!backend/**/index.{js,ts}',
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'html', 'lcov', 'json', 'json-summary'],

  // Coverage directory
  coverageDirectory: 'coverage',

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,

  // Reset modules between tests
  resetModules: true,

  // Verbose output
  verbose: true,

  // Bail on first failure
  bail: false,

  // Force exit
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Global setup and teardown
  globalSetup: '<rootDir>/tests/global-setup.ts',
  globalTeardown: '<rootDir>/tests/global-teardown.ts',

  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost',
  },

  // Module path ignore patterns
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
  ],

  // Transform ignore patterns
  transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$))'],

  // Extensions to treat as ES modules
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  // Globals
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },

  // Projects for different test types
  projects: [
    {
      displayName: 'unit',
      testMatch: [
        '<rootDir>/**/__tests__/**/*.(test|spec).(js|jsx|ts|tsx)',
        '<rootDir>/**/*.(test|spec).(js|jsx|ts|tsx)',
      ],
      testPathIgnorePatterns: [
        '**/integration/**',
        '**/e2e/**',
      ],
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/**/integration/**/*.(test|spec).(js|jsx|ts|tsx)'],
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/**/e2e/**/*.(test|spec).(js|jsx|ts|tsx)'],
    },
  ],

  // Watch plugins - disabled for now
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname',
  // ],

  // Notify mode - disabled for now
  notify: false,
  // notifyMode: 'change',

  // Error on deprecated
  errorOnDeprecated: true,

  // Max workers
  maxWorkers: '50%',

  // Worker idle memory limit
  workerIdleMemoryLimit: '512MB',

  // Cache
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',

  // Roots
  roots: ['<rootDir>/backend', '<rootDir>/tests'],

  // Test location
  testLocationInResults: true,

  // Update snapshots
  updateSnapshot: false,

  // Snapshot serializers - disabled for now
  // snapshotSerializers: [
  //   'jest-serializer-path',
  // ],

  // Setup files for specific environments
  setupFiles: ['<rootDir>/tests/env-setup.ts'],

  // Test results processor - disabled for now
  // testResultsProcessor: 'jest-sonar-reporter',

  // Reporters
  reporters: [
    'default',
    // [
    //   'jest-junit',
    //   {
    //     outputDirectory: 'reports/junit',
    //     outputName: 'js-test-results.xml',
    //     classNameTemplate: '{classname}-{title}',
    //     titleTemplate: '{classname}-{title}',
    //     ancestorSeparator: ' › ',
    //     usePathForSuiteName: true,
    //   },
    // ],
    // [
    //   'jest-html-reporters',
    //   {
    //     publicPath: './reports/html-report',
    //     filename: 'test-report.html',
    //     expand: true,
    //   },
    // ],
  ],
};
