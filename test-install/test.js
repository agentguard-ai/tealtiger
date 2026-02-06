// Test the published SDK
const { AgentGuard } = require('agentguard-sdk');

console.log('✅ SDK imported successfully!');
console.log('AgentGuard class:', typeof AgentGuard);

// Test basic instantiation
try {
  const agentGuard = new AgentGuard({
    apiKey: 'test-api-key-12345',
    ssaUrl: 'https://localhost:3001'
  });
  console.log('✅ AgentGuard instance created successfully!');
  console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(agentGuard)));
} catch (error) {
  console.error('❌ Error creating AgentGuard instance:', error.message);
}