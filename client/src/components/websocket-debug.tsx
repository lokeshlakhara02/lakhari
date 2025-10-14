import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { getWebSocketUrl, validateWebSocketUrl } from '@/lib/websocket-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';

export function WebSocketDebug() {
  const [wsUrl, setWsUrl] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);
  const { isConnected, userId, reconnectAttempts, connectionQuality, lastHeartbeat, connectionType } = useWebSocket();

  useEffect(() => {
    const url = getWebSocketUrl('/ws');
    setWsUrl(url);
    setIsValidUrl(validateWebSocketUrl(url));
    
    // Add initial log
    setConnectionLog(prev => [...prev, `WebSocket URL: ${url}`]);
    setConnectionLog(prev => [...prev, `URL Valid: ${validateWebSocketUrl(url)}`]);
    setConnectionLog(prev => [...prev, `Environment: ${import.meta.env.MODE}`]);
    setConnectionLog(prev => [...prev, `Hostname: ${window.location.hostname}`]);
    setConnectionLog(prev => [...prev, `Port: ${window.location.port || 'default'}`]);
    setConnectionLog(prev => [...prev, `Protocol: ${window.location.protocol}`]);
  }, []);

  useEffect(() => {
    const status = isConnected ? 'Connected' : 'Disconnected';
    const quality = connectionQuality !== 'unknown' ? ` (${connectionQuality})` : '';
    setConnectionLog(prev => [...prev, `Status: ${status}${quality}`]);
    
    if (userId) {
      setConnectionLog(prev => [...prev, `User ID: ${userId}`]);
    }
    
    if (reconnectAttempts > 0) {
      setConnectionLog(prev => [...prev, `Reconnect attempts: ${reconnectAttempts}`]);
    }
    
    if (lastHeartbeat) {
      setConnectionLog(prev => [...prev, `Last heartbeat: ${lastHeartbeat.toLocaleTimeString()}`]);
    }
  }, [isConnected, userId, reconnectAttempts, connectionQuality, lastHeartbeat]);

  const clearLog = () => {
    setConnectionLog([]);
  };

  const getStatusIcon = () => {
    if (isConnected) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (reconnectAttempts > 0) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    if (isConnected) return 'bg-green-500';
    if (reconnectAttempts > 0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          WebSocket Connection Debug
          <Badge className={getStatusColor()}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          <span className="text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
            {connectionQuality !== 'unknown' && ` (${connectionQuality})`}
          </span>
        </div>

        <div className="space-y-2">
          <div className="text-sm">
            <strong>WebSocket URL:</strong> {wsUrl}
          </div>
          <div className="text-sm">
            <strong>URL Valid:</strong> 
            <Badge variant={isValidUrl ? 'default' : 'destructive'} className="ml-2">
              {isValidUrl ? 'Valid' : 'Invalid'}
            </Badge>
          </div>
          <div className="text-sm">
            <strong>User ID:</strong> {userId || 'Not assigned'}
          </div>
          <div className="text-sm">
            <strong>Reconnect Attempts:</strong> {reconnectAttempts}
          </div>
          <div className="text-sm">
            <strong>Connection Type:</strong> 
            <Badge variant={connectionType === 'websocket' ? 'default' : 'secondary'} className="ml-2">
              {connectionType === 'websocket' ? 'WebSocket' : 'Polling'}
            </Badge>
          </div>
          {lastHeartbeat && (
            <div className="text-sm">
              <strong>Last Heartbeat:</strong> {lastHeartbeat.toLocaleTimeString()}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <strong className="text-sm">Connection Log:</strong>
            <Button variant="outline" size="sm" onClick={clearLog}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>
          <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md max-h-60 overflow-y-auto">
            <pre className="text-xs space-y-1">
              {connectionLog.map((log, index) => (
                <div key={index} className="text-gray-700 dark:text-gray-300">
                  {log}
                </div>
              ))}
            </pre>
          </div>
        </div>

        <div className="text-xs text-gray-500 dark:text-gray-400">
          <p><strong>Environment:</strong> {import.meta.env.MODE}</p>
          <p><strong>Hostname:</strong> {window.location.hostname}</p>
          <p><strong>Port:</strong> {window.location.port || 'default'}</p>
          <p><strong>Protocol:</strong> {window.location.protocol}</p>
        </div>
      </CardContent>
    </Card>
  );
}
