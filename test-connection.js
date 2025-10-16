// Simple test script to verify WebSocket connection and matching
const WebSocket = require('ws');

const testConnection = () => {
  console.log('🧪 Testing WebSocket connection and matching...');
  
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Send join message
    ws.send(JSON.stringify({
      type: 'join',
      userId: 'test-user-' + Date.now()
    }));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('📨 Received message:', message.type, message);
    
    if (message.type === 'user_joined') {
      // Send find_match request
      ws.send(JSON.stringify({
        type: 'find_match',
        chatType: 'video',
        interests: ['gaming', 'music'],
        gender: 'male'
      }));
    }
    
    if (message.type === 'waiting_for_match') {
      console.log('⏳ Waiting for match...', message);
    }
    
    if (message.type === 'match_found') {
      console.log('🎉 Match found!', message);
      ws.close();
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });
};

// Run test
testConnection();
