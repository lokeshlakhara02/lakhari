#!/usr/bin/env node

/**
 * WebSocket debugging script
 * Connects to the WebSocket and sends test messages
 */

const WebSocket = require('ws');

// Configuration
const WS_URL = process.env.TEST_WS_URL || 'wss://lakhari.com/ws';

console.log('🔌 Testing WebSocket connection...');
console.log(`WebSocket URL: ${WS_URL}`);

function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    let messageCount = 0;
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected successfully');
      
      // Send join message
      const joinMessage = {
        type: 'join',
        interests: ['testing', 'debug']
      };
      
      console.log('📤 Sending join message:', joinMessage);
      ws.send(JSON.stringify(joinMessage));
      
      // Send find_match message after a short delay
      setTimeout(() => {
        const findMatchMessage = {
          type: 'find_match',
          chatType: 'video',
          interests: ['testing', 'debug'],
          gender: 'male'
        };
        
        console.log('📤 Sending find_match message:', findMatchMessage);
        ws.send(JSON.stringify(findMatchMessage));
      }, 1000);
    });
    
    ws.on('message', (data) => {
      messageCount++;
      try {
        const message = JSON.parse(data.toString());
        console.log(`📥 Message ${messageCount} received:`, message.type, message);
        
        if (message.type === 'user_joined') {
          console.log('🎉 User joined successfully, ID:', message.userId);
        }
        
        if (message.type === 'match_found') {
          console.log('🎯 Match found! Session ID:', message.sessionId);
        }
        
        if (message.type === 'waiting_for_match') {
          console.log('⏳ Waiting for match. Queue position:', message.queuePosition);
        }
        
        if (message.type === 'error') {
          console.log('❌ Error received:', message.message);
        }
        
      } catch (error) {
        console.log('❌ Failed to parse message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.log('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed. Code: ${code}, Reason: ${reason}`);
      resolve();
    });
    
    // Close connection after 10 seconds
    setTimeout(() => {
      console.log('⏰ Closing connection after 10 seconds...');
      ws.close(1000, 'Test completed');
    }, 10000);
  });
}

// Run the test
async function runTest() {
  try {
    console.log('🚀 Starting WebSocket test...\n');
    await testWebSocketConnection();
    console.log('\n✅ WebSocket test completed');
  } catch (error) {
    console.error('\n❌ WebSocket test failed:', error.message);
    process.exit(1);
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runTest();
}

module.exports = { testWebSocketConnection, runTest };
