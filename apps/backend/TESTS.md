# Backend Tests Structure

This document describes the test organization in the backend application.

## Directory Structure

```
apps/backend/
├── src/                    # Source code
├── tests/                  # Unit tests
│   ├── app.module.spec.ts
│   └── token/
│       └── token.service.spec.ts
└── integration/            # Integration tests
    ├── jest-integration.json
    ├── setup.ts
    ├── token.integration-spec.ts
    └── transfer.integration-spec.ts
```

## Test Types

### Unit Tests (`tests/` folder)
- **Location**: `tests/` directory
- **Purpose**: Test individual components, services, and modules in isolation
- **Configuration**: Uses main Jest config in `package.json`
- **Command**: `npm test`
- **Structure**: Mirrors the `src/` directory structure

### Integration Tests (`integration/` folder)
- **Location**: `integration/` directory  
- **Purpose**: Test API endpoints and service interactions with mocked dependencies
- **Configuration**: Uses `integration/jest-integration.json`
- **Command**: `npm run test:integration` or `npm run test:e2e`
- **Features**: 
  - Tests HTTP endpoints using supertest
  - Mocks external dependencies (database, file system)
  - Validates request/response flow
  - Tests validation pipes and error handling

## Jest Configuration

### Unit Tests
- **Root**: `tests/`
- **Test Pattern**: `*.spec.ts`
- **Coverage**: Collected from `../src/**/*.(t|j)s`
- **Coverage Output**: `../coverage/`

### Integration Tests
- **Root**: `integration/`
- **Test Pattern**: `*.integration-spec.ts`
- **Environment**: Node.js
- **Timeout**: 30 seconds
- **Setup**: Global setup file for test environment configuration

## Running Tests

```bash
# Run unit tests
npm test

# Run unit tests in watch mode
npm run test:watch

# Run unit tests with coverage
npm run test:cov

# Run integration tests
npm run test:integration
# or
npm run test:e2e

# Run integration tests in debug mode
npm run test:debug
```

## Migration Summary

The following changes were made to reorganize the test structure:

1. **Moved unit tests** from `src/` to dedicated `tests/` directory
2. **Converted e2e tests to integration tests**:
   - Renamed `test/` folder to `integration/`
   - Updated test files from `*.e2e-spec.ts` to `*.integration-spec.ts`
   - Created focused integration tests for API endpoints
   - Added proper mocking for external dependencies
3. **Updated configurations**:
   - Modified Jest configurations for both test types
   - Updated lint and format scripts
   - Added validation pipes to integration tests
4. **Created meaningful test scenarios**:
   - Token service integration tests
   - Transfer controller endpoint tests with validation
   - Error handling scenarios

## Benefits

- **Clear Separation**: Unit tests and integration tests are in separate folders
- **Faster Execution**: Integration tests use mocks instead of real databases
- **Better Coverage**: Tests cover both isolated units and API integration
- **Maintainable**: Each test type has its own configuration and setup
- **Realistic Testing**: Integration tests validate actual HTTP request/response cycles
