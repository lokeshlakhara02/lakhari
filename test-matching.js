// Test script to verify user matching with two users
const WebSocket = require('ws');

const createTestUser = (userId, interests = ['gaming', 'music'], gender = 'male') => {
  return new Promise((resolve, reject) => {
    console.log(`🧪 Creating test user: ${userId}`);
    
    const ws = new WebSocket('ws://localhost:3000');
    let connected = false;
    
    ws.on('open', () => {
      console.log(`✅ User ${userId} connected`);
      
      // Send join message
      ws.send(JSON.stringify({
        type: 'join',
        userId: userId
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log(`📨 User ${userId} received:`, message.type);
      
      if (message.type === 'user_joined') {
        console.log(`👤 User ${userId} joined successfully`);
        
        // Send find_match request
        ws.send(JSON.stringify({
          type: 'find_match',
          chatType: 'video',
          interests: interests,
          gender: gender
        }));
        console.log(`🔍 User ${userId} looking for match...`);
      }
      
      if (message.type === 'waiting_for_match') {
        console.log(`⏳ User ${userId} waiting for match...`, message);
      }
      
      if (message.type === 'match_found') {
        console.log(`🎉 User ${userId} found match!`, message);
        connected = true;
        resolve({ userId, ws, message });
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ User ${userId} error:`, error);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log(`🔌 User ${userId} disconnected`);
    });
  });
};

const testMatching = async () => {
  console.log('🚀 Starting matching test with two users...');
  
  try {
    // Create two users with different genders for better matching
    const user1 = await createTestUser('test-user-1', ['gaming', 'music'], 'male');
    const user2 = await createTestUser('test-user-2', ['gaming', 'sports'], 'female');
    
    console.log('✅ Both users created successfully');
    console.log('📊 Test completed - check server logs for matching details');
    
    // Keep connections alive for a bit to see the matching process
    setTimeout(() => {
      user1.ws.close();
      user2.ws.close();
      console.log('🔚 Test completed, connections closed');
    }, 10000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
};

// Run the test
testMatching();
