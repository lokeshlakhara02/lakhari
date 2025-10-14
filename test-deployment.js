#!/usr/bin/env node

/**
 * Simple deployment test script
 * Tests the main endpoints and WebSocket functionality
 */

const https = require('https');
const http = require('http');
const WebSocket = require('ws');

// Configuration
const BASE_URL = process.env.TEST_URL || 'https://tv5h5far.up.railway.app';
const WS_URL = BASE_URL.replace('https:', 'wss:').replace('http:', 'ws:');

console.log('🚀 Testing deployment...');
console.log(`Base URL: ${BASE_URL}`);
console.log(`WebSocket URL: ${WS_URL}`);

// Test HTTP endpoints
async function testEndpoints() {
  console.log('\n📡 Testing HTTP endpoints...');
  
  const endpoints = [
    '/',
    '/api/health',
    '/api/stats',
    '/api/analytics'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const url = `${BASE_URL}${endpoint}`;
      console.log(`  Testing: ${endpoint}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Deployment-Test/1.0'
        }
      });
      
      if (response.ok) {
        console.log(`    ✅ ${response.status} ${response.statusText}`);
      } else {
        console.log(`    ❌ ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
    }
  }
}

// Test WebSocket connection
function testWebSocket() {
  return new Promise((resolve) => {
    console.log('\n🔌 Testing WebSocket connection...');
    
    const ws = new WebSocket(`${WS_URL}/ws`);
    let connected = false;
    let receivedMessage = false;
    
    const timeout = setTimeout(() => {
      if (!connected) {
        console.log('    ❌ WebSocket connection timeout');
        ws.close();
        resolve(false);
      }
    }, 10000);
    
    ws.on('open', () => {
      console.log('    ✅ WebSocket connected');
      connected = true;
      
      // Send a test message
      ws.send(JSON.stringify({
        type: 'join',
        interests: ['testing']
      }));
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log(`    ✅ Received message: ${message.type}`);
        receivedMessage = true;
        
        // Close after receiving a message
        setTimeout(() => {
          ws.close();
          resolve(true);
        }, 1000);
      } catch (error) {
        console.log(`    ❌ Error parsing message: ${error.message}`);
      }
    });
    
    ws.on('error', (error) => {
      console.log(`    ❌ WebSocket error: ${error.message}`);
      clearTimeout(timeout);
      resolve(false);
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (connected) {
        console.log('    ✅ WebSocket closed cleanly');
      }
    });
  });
}

// Test CSP headers
async function testCSPHeaders() {
  console.log('\n🛡️  Testing CSP headers...');
  
  try {
    const response = await fetch(BASE_URL, {
      method: 'HEAD'
    });
    
    const csp = response.headers.get('content-security-policy');
    if (csp) {
      console.log('    ✅ CSP header present');
      
      // Check for Google Fonts support
      if (csp.includes('fonts.googleapis.com') && csp.includes('fonts.gstatic.com')) {
        console.log('    ✅ Google Fonts allowed in CSP');
      } else {
        console.log('    ⚠️  Google Fonts may not be allowed in CSP');
      }
      
      // Check for WebSocket support
      if (csp.includes('ws:') && csp.includes('wss:')) {
        console.log('    ✅ WebSocket connections allowed in CSP');
      } else {
        console.log('    ⚠️  WebSocket connections may not be allowed in CSP');
      }
    } else {
      console.log('    ⚠️  No CSP header found');
    }
  } catch (error) {
    console.log(`    ❌ Error testing CSP: ${error.message}`);
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Starting deployment tests...\n');
  
  try {
    await testEndpoints();
    await testCSPHeaders();
    const wsSuccess = await testWebSocket();
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    if (wsSuccess) {
      console.log('✅ WebSocket connection: Working');
    } else {
      console.log('❌ WebSocket connection: Failed');
    }
    
    console.log('\n🎉 Deployment test completed!');
    
    if (wsSuccess) {
      console.log('\n💡 Your deployment appears to be working correctly!');
      console.log('   Users should now be able to connect and match with each other.');
    } else {
      console.log('\n⚠️  WebSocket connection failed. This may affect real-time features.');
      console.log('   However, the polling fallback should still work for basic functionality.');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = { runTests, testEndpoints, testWebSocket, testCSPHeaders };
