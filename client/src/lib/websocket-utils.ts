/**
 * WebSocket utility functions for handling different environments
 */

export function getWebSocketHost(): string {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return 'localhost:8080'; // Fallback for SSR
  }
  
  // Development mode detection
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  
  const isDevPort = window.location.port === '5173';
  
  if (isLocalhost && isDevPort) {
    return 'localhost:8080';
  }
  
  // Production mode - use same host as the current page
  // For Railway deployment, both frontend and backend are served from the same origin
  const hostname = window.location.hostname;
  
  // For production deployments, use the same hostname as the current page
  // Railway serves everything on the same domain
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'localhost:8080';
  }
  
  // For Railway and other cloud deployments, don't include port
  // The WebSocket server runs on the same port as the HTTP server
  return hostname;
}

export function getWebSocketProtocol(): string {
  if (typeof window === 'undefined') {
    return 'ws:';
  }
  
  return window.location.protocol === "https:" ? "wss:" : "ws:";
}

export function getWebSocketUrl(path: string = '/ws'): string {
  const protocol = getWebSocketProtocol();
  const host = getWebSocketHost();
  
  // Clean the path to ensure it doesn't have query parameters or fragments
  const cleanPath = path.split('?')[0].split('#')[0];
  
  // Debug logging
  console.log('WebSocket URL generation:', {
    protocol,
    host,
    path: cleanPath,
    hostname: typeof window !== 'undefined' ? window.location.hostname : 'undefined',
    port: typeof window !== 'undefined' ? window.location.port : 'undefined',
    origin: typeof window !== 'undefined' ? window.location.origin : 'undefined'
  });
  
  // Ensure we have valid protocol and host
  if (!protocol || !host || protocol.includes('undefined') || host.includes('undefined')) {
    console.error('WebSocket: Invalid protocol or host', { protocol, host });
    // Fallback to localhost:8080
    return 'ws://localhost:8080/ws';
  }
  
  const url = `${protocol}//${host}${cleanPath}`;
  
  // Final safety check
  if (url.includes('undefined') || url.includes('null')) {
    console.error('WebSocket: URL contains invalid values, using fallback', url);
    return 'ws://localhost:8080/ws';
  }
  
  console.log('Generated WebSocket URL:', url);
  return url;
}

export function validateWebSocketUrl(url: string): boolean {
  if (!url || 
      url.includes('undefined') || 
      url.includes('null') ||
      url.includes('NaN')) {
    console.error('WebSocket: Invalid URL contains undefined/null/NaN:', url);
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    
    // Additional validation
    if (!urlObj.hostname || urlObj.hostname === 'undefined') {
      console.error('WebSocket: Invalid hostname:', urlObj.hostname);
      return false;
    }
    
    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
      console.error('WebSocket: Invalid protocol, must start with ws:// or wss://');
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('WebSocket: URL parsing failed:', error, 'for URL:', url);
    return false;
  }
}
