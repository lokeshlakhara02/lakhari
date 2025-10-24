import type { Request, Response, NextFunction } from 'express';

// Enhanced rate limiter with multiple tiers
interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastRequest: number;
  violations: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDuration: number;
  maxViolations: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const blockedIPs = new Map<string, number>(); // IP -> blockUntil timestamp

// Different rate limits for different endpoints
const rateLimitConfigs: Record<string, RateLimitConfig> = {
  default: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    blockDuration: 30 * 60 * 1000, // 30 minutes
    maxViolations: 3
  },
  websocket: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20,
    blockDuration: 10 * 60 * 1000, // 10 minutes
    maxViolations: 2
  },
  api: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 50,
    blockDuration: 15 * 60 * 1000, // 15 minutes
    maxViolations: 3
  }
};

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const entries = Array.from(rateLimitStore.entries());
  for (const [key, entry] of entries) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  // Skip rate limiting in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Skip rate limiting for certain public endpoints
  const publicEndpoints = [
    '/api/stats',
    '/api/health',
    '/api/analytics',
    '/api/interests/suggestions',
    '/api/poll'
  ];
  
  if (publicEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  const identifier = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  let entry = rateLimitStore.get(identifier);
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    entry = {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW,
    };
    rateLimitStore.set(identifier, entry);
    return next();
  }
  
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    res.set('Retry-After', retryAfter.toString());
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter,
    });
  }
  
  entry.count++;
  next();
}

// Security headers middleware
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Only apply in production or if explicitly enabled
  if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SECURITY_HEADERS !== 'true') {
    return next();
  }

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Enable browser XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Needed for Vite in dev
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts
    "font-src 'self' data: https://fonts.gstatic.com", // Allow Google Fonts
    "img-src 'self' data: blob: https:",
    "connect-src 'self' ws: wss: https:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  
  // Strict Transport Security (HTTPS only)
  if (req.secure || req.headers['x-forwarded-proto'] === 'https' || req.headers['x-forwarded-ssl'] === 'on') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 'camera=*, microphone=*, geolocation=()');
  
  next();
}

// Input sanitization helper
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove control characters except newline and tab
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  return sanitized;
}

// Validate message content
export function validateMessage(content: string, maxLength: number = 5000): {
  isValid: boolean;
  error?: string;
  sanitized: string;
} {
  const sanitized = sanitizeInput(content);
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Message cannot be empty', sanitized };
  }
  
  if (sanitized.length > maxLength) {
    return { isValid: false, error: `Message too long (max ${maxLength} characters)`, sanitized };
  }
  
  // Check for excessive repeated characters (basic spam detection)
  const repeatedCharsPattern = /(.)\1{50,}/;
  if (repeatedCharsPattern.test(sanitized)) {
    return { isValid: false, error: 'Message contains excessive repeated characters', sanitized };
  }
  
  return { isValid: true, sanitized };
}

// WebSocket connection tracking
const wsConnectionsByIP = new Map<string, number>();

export function trackWSConnection(ip: string): boolean {
  const maxConnections = parseInt(process.env.MAX_WS_CONNECTIONS_PER_IP || '5', 10);
  const currentConnections = wsConnectionsByIP.get(ip) || 0;
  
  if (currentConnections >= maxConnections) {
    return false; // Reject connection
  }
  
  wsConnectionsByIP.set(ip, currentConnections + 1);
  return true; // Allow connection
}

export function untrackWSConnection(ip: string): void {
  const currentConnections = wsConnectionsByIP.get(ip) || 0;
  if (currentConnections > 0) {
    wsConnectionsByIP.set(ip, currentConnections - 1);
  }
}

export function getWSConnectionCount(ip: string): number {
  return wsConnectionsByIP.get(ip) || 0;
}

// Request logging helper
export function logRequest(method: string, path: string, statusCode: number, duration: number, extra?: Record<string, any>) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') return;
  
  // Skip logging if disabled
  if (process.env.ENABLE_REQUEST_LOGGING === 'false') return;
  
  // Only log errors and warnings in production
  if (process.env.NODE_ENV === 'production' && logLevel !== 'debug' && statusCode < 400) {
    return;
  }
  
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
    ...extra,
  };
  
  if (statusCode >= 500) {
    console.error('[ERROR]', JSON.stringify(logEntry));
  } else if (statusCode >= 400) {
    console.warn('[WARN]', JSON.stringify(logEntry));
  } else {
    console.log('[INFO]', JSON.stringify(logEntry));
  }
}

// Error logger
export function logError(error: Error, context?: Record<string, any>) {
  const timestamp = new Date().toISOString();
  console.error('[ERROR]', {
    timestamp,
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

