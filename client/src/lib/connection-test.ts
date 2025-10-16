/**
 * Simple connection test utility to verify WebSocket and WebRTC functionality
 */

export function testWebSocketConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const wsUrl = process.env.NODE_ENV === 'development' 
        ? 'ws://localhost:8080/ws' 
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
      
      console.log('Testing WebSocket connection to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        ws.close();
        resolve(false);
      }, 5000);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connection successful');
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket connection failed:', error);
        clearTimeout(timeout);
        resolve(false);
      };
      
      ws.onclose = () => {
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('WebSocket test failed:', error);
      resolve(false);
    }
  });
}

export function testWebRTCConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Test if WebRTC is supported
      if (!window.RTCPeerConnection) {
        console.error('❌ WebRTC not supported');
        resolve(false);
        return;
      }
      
      // Test if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.error('❌ getUserMedia not supported');
        resolve(false);
        return;
      }
      
      console.log('✅ WebRTC and getUserMedia are supported');
      resolve(true);
    } catch (error) {
      console.error('WebRTC test failed:', error);
      resolve(false);
    }
  });
}

export async function runConnectionTests(): Promise<{
  websocket: boolean;
  webrtc: boolean;
  overall: boolean;
}> {
  console.log('🧪 Running connection tests...');
  
  const websocket = await testWebSocketConnection();
  const webrtc = await testWebRTCConnection();
  const overall = websocket && webrtc;
  
  console.log('📊 Test Results:');
  console.log(`  WebSocket: ${websocket ? '✅' : '❌'}`);
  console.log(`  WebRTC: ${webrtc ? '✅' : '❌'}`);
  console.log(`  Overall: ${overall ? '✅' : '❌'}`);
  
  return { websocket, webrtc, overall };
}
