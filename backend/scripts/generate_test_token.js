/**
 * scripts/generate_test_token.js
 * Generates a valid JWT for local API testing.
 * Uses the same JWT_SECRET as the server.
 */
require('dotenv').config();
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  { id: 'test-user-001', email: 'admin@test.com', role: 'admin' },
  process.env.JWT_SECRET,
  { expiresIn: '24h' }
);

console.log('\n🔑 Test JWT Token (valid 24h):\n');
console.log(token);
console.log('\nUsage:');
console.log(`  -H "Authorization: Bearer ${token.substring(0, 20)}..."\n`);
