/**
 * WebSocket Protection - Prevents external interference with our WebSocket connections
 */

// Store the original WebSocket constructor
const OriginalWebSocket = window.WebSocket;

// Track our legitimate WebSocket connections
const legitimateConnections = new Set<string>();

// Monitor and block invalid WebSocket connections
const protectedWebSocket = class extends OriginalWebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    const urlString = typeof url === 'string' ? url : url.toString();
    
    // Get stack trace to identify the source
    const stack = new Error().stack;
    const callerInfo = stack?.split('\n')[2] || 'unknown';
    
    // Check if this is a legitimate connection from our app or Vite HMR
    const isViteHMR = urlString.includes('/@vite/') || 
                      urlString.includes('?token=') ||
                      callerInfo.includes('vite/client');
    
    const isLegitimateConnection = (urlString.includes('/ws') && 
                                    !urlString.includes('undefined') && 
                                    !urlString.includes('localhost:undefined')) ||
                                   isViteHMR;
    
    if (!isLegitimateConnection) {
      // Silently block external/invalid WebSocket connections
      // Create a dummy WebSocket that will immediately fail
      super('ws://invalid-url-blocked');
      setTimeout(() => {
        this.dispatchEvent(new Event('error'));
        this.close();
      }, 0);
      return;
    }
    
    // This is a legitimate connection, proceed normally
    legitimateConnections.add(urlString);
    super(url, protocols);
  }
};

// Replace the global WebSocket with our protected version
if (typeof window !== 'undefined') {
  (window as any).WebSocket = protectedWebSocket;
}

// Export for manual control
export function blockWebSocket(url: string) {
  legitimateConnections.delete(url);
}

export function allowWebSocket(url: string) {
  legitimateConnections.add(url);
}

export function isLegitimateWebSocket(url: string): boolean {
  return legitimateConnections.has(url);
}
