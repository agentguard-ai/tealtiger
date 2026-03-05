module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
<<<<<<< HEAD
    '**/__tests__/**/*.ts',
=======
    '**/__tests__/**/*.test.ts',
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  coverageThreshold: {
    global: {
<<<<<<< HEAD
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
=======
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
>>>>>>> 8845eb6888bee5ea34f0a66b9da1a773d51da53a
    }
  }
};