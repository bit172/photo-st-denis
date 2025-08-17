// Global setup for integration tests
jest.setTimeout(30000)

// Set environment variables for testing
process.env.NODE_ENV = 'test'
process.env.SKIP_MONGO = 'true' // Skip MongoDB connections for now
