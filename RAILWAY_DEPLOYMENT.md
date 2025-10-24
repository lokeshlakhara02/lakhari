# Railway.app Free Tier Deployment Guide

This guide helps you deploy OmegleWeb on Railway.app's free tier with optimizations for the 512MB RAM, 1 CPU core, and 1GB storage limits.

## Prerequisites

1. Railway.app account
2. GitHub repository with your code
3. PostgreSQL database (Railway provides this)

## Deployment Steps

### 1. Connect to Railway

1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your OmegleWeb repository

### 2. Configure Environment Variables

In your Railway project dashboard, go to Variables and add:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database

# Railway Optimizations
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=400 --optimize-for-size
MAX_CONNECTIONS=40
RATE_LIMIT_MAX=50
MAX_WS_CONNECTIONS_PER_IP=3
LOG_LEVEL=warn
ENABLE_REQUEST_LOGGING=false
ENABLE_SECURITY_HEADERS=true

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_CONNECTION_TIMEOUT=300000
WS_MAX_CONNECTIONS=40

# Caching
CACHE_TTL=300000
CACHE_MAX_SIZE=100

# Security
CORS_ORIGIN=*
TRUST_PROXY=1

# Railway specific
RAILWAY_ENVIRONMENT=production
RAILWAY_OPTIMIZATION=true
RAILWAY_MEMORY_LIMIT=400
RAILWAY_CPU_LIMIT=70
```

### 3. Configure Build Settings

In Railway project settings:

1. **Build Command**: `npm run railway:build`
2. **Start Command**: `npm run railway:start`
3. **Root Directory**: `/` (default)

### 4. Database Setup

1. Add PostgreSQL service in Railway
2. Copy the DATABASE_URL from the PostgreSQL service
3. Add it to your environment variables
4. Run database migrations: `npm run db:push`

### 5. Deploy

1. Railway will automatically deploy when you push to your main branch
2. Monitor the deployment logs for any issues
3. Check the health endpoint: `https://your-app.railway.app/api/health`

## Free Tier Optimizations

### Memory Management
- **Memory Limit**: 400MB (100MB buffer from 512MB limit)
- **Garbage Collection**: Automatic cleanup every 30 seconds
- **Connection Pooling**: Limited to 40 concurrent connections
- **Caching**: In-memory only, no Redis

### CPU Optimization
- **Single Process**: No clustering (saves CPU)
- **Reduced Logging**: Minimal console output
- **Optimized Build**: Production build with optimizations

### Network Optimization
- **Rate Limiting**: 50 requests per 15 minutes per IP
- **WebSocket Limits**: 3 connections per IP
- **Request Caching**: Reduced API calls

### Database Optimization
- **Connection Pool**: 5 connections max
- **Query Optimization**: Cached queries
- **Batch Operations**: Reduced database calls

## Monitoring

### Health Checks
- **Endpoint**: `/api/health`
- **Interval**: Every 30 seconds
- **Timeout**: 3 seconds

### Metrics
- **Memory Usage**: Monitored every 10 seconds
- **Connection Count**: Tracked in real-time
- **Error Rate**: Logged and monitored

### Alerts
- **Memory**: Warning at 80% usage
- **CPU**: Warning at 70% usage
- **Connections**: Warning at 80% capacity

## Troubleshooting

### Common Issues

1. **Out of Memory**
   - Check memory usage in Railway dashboard
   - Reduce MAX_CONNECTIONS if needed
   - Enable garbage collection

2. **High CPU Usage**
   - Check for infinite loops
   - Reduce logging frequency
   - Optimize database queries

3. **Connection Limits**
   - Reduce WS_MAX_CONNECTIONS
   - Implement connection pooling
   - Add connection timeouts

4. **Database Issues**
   - Check DATABASE_URL
   - Verify database migrations
   - Monitor connection pool

### Performance Tips

1. **Enable Compression**: Use Railway's built-in compression
2. **Optimize Images**: Compress images before upload
3. **Cache Static Assets**: Use CDN for static files
4. **Monitor Metrics**: Check Railway dashboard regularly

## Scaling Considerations

### When to Upgrade
- Memory usage consistently > 80%
- CPU usage consistently > 70%
- More than 40 concurrent users
- Database query timeouts

### Upgrade Options
1. **Railway Pro**: $5/month for 1GB RAM
2. **Railway Team**: $20/month for 2GB RAM
3. **Custom Plan**: For higher limits

## Security

### Free Tier Security
- **HTTPS**: Automatic SSL certificates
- **CORS**: Configured for your domain
- **Rate Limiting**: Protection against abuse
- **Input Validation**: All inputs sanitized

### Additional Security
- **Helmet**: Security headers (disabled for free tier)
- **Compression**: Gzip compression (disabled for free tier)
- **Session Security**: Secure session configuration

## Cost Optimization

### Free Tier Limits
- **512MB RAM**: Optimized for 400MB usage
- **1 CPU Core**: Single process optimization
- **1GB Storage**: Minimal file storage
- **$5 Credit**: Monthly usage allowance

### Cost Saving Tips
1. **Reduce Logging**: Minimal console output
2. **Optimize Images**: Compress before upload
3. **Cache Queries**: Reduce database calls
4. **Connection Pooling**: Reuse connections
5. **Garbage Collection**: Regular memory cleanup

## Support

### Railway Support
- **Documentation**: [Railway Docs](https://docs.railway.app)
- **Community**: [Railway Discord](https://discord.gg/railway)
- **GitHub**: [Railway GitHub](https://github.com/railwayapp)

### Application Support
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: Support email

## Updates

### Automatic Updates
- Railway automatically redeploys on git push
- Database migrations run automatically
- Environment variables can be updated in dashboard

### Manual Updates
1. Update code in GitHub
2. Railway detects changes
3. Automatic deployment starts
4. Monitor deployment logs
5. Verify health endpoint

This deployment guide ensures your OmegleWeb application runs efficiently on Railway's free tier while maintaining good performance and user experience.
