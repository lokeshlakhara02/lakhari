/**
 * WebSocket connection test utility
 */

export function testWebSocketConnection(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Import the WebSocket utilities
      import('./websocket-utils').then(({ getWebSocketUrl, validateWebSocketUrl }) => {
        const wsUrl = getWebSocketUrl('/ws');
        
        console.log('Testing WebSocket connection to:', wsUrl);
        
        if (!validateWebSocketUrl(wsUrl)) {
          console.error('WebSocket URL validation failed:', wsUrl);
          resolve(false);
          return;
        }
        
        const ws = new WebSocket(wsUrl);
        
        const timeout = setTimeout(() => {
          console.error('WebSocket connection timeout');
          ws.close();
          resolve(false);
        }, 5000);
        
        ws.onopen = () => {
          console.log('WebSocket test connection successful');
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket test connection failed:', error);
          clearTimeout(timeout);
          resolve(false);
        };
        
        ws.onclose = () => {
          clearTimeout(timeout);
        };
      }).catch((error) => {
        console.error('Failed to import WebSocket utilities:', error);
        resolve(false);
      });
    } catch (error) {
      console.error('WebSocket test failed:', error);
      resolve(false);
    }
  });
}

// Auto-test on load in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    testWebSocketConnection().then((success) => {
      if (success) {
        console.log('✅ WebSocket connection test passed');
      } else {
        console.error('❌ WebSocket connection test failed');
      }
    });
  }, 1000);
}
