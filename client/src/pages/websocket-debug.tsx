import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getWebSocketUrl, validateWebSocketUrl } from '@/lib/websocket-utils';

interface ConnectionTest {
  id: number;
  url: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  timestamp: Date;
}

export default function WebSocketDebug() {
  const [tests, setTests] = useState<ConnectionTest[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const runTest = async () => {
    setIsRunning(true);
    const testId = Date.now();
    
    try {
      const wsUrl = getWebSocketUrl('/ws');
      
      // Add initial test
      const initialTest: ConnectionTest = {
        id: testId,
        url: wsUrl,
        status: 'pending',
        timestamp: new Date()
      };
      
      setTests(prev => [initialTest, ...prev]);
      
      // Validate URL
      if (!validateWebSocketUrl(wsUrl)) {
        setTests(prev => prev.map(t => 
          t.id === testId 
            ? { ...t, status: 'error', error: 'Invalid WebSocket URL' }
            : t
        ));
        return;
      }
      
      // Test connection
      const ws = new WebSocket(wsUrl);
      
      const timeout = setTimeout(() => {
        ws.close();
        setTests(prev => prev.map(t => 
          t.id === testId 
            ? { ...t, status: 'error', error: 'Connection timeout' }
            : t
        ));
      }, 5000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        setTests(prev => prev.map(t => 
          t.id === testId 
            ? { ...t, status: 'success' }
            : t
        ));
        ws.close();
      };
      
      ws.onerror = (error) => {
        clearTimeout(timeout);
        setTests(prev => prev.map(t => 
          t.id === testId 
            ? { ...t, status: 'error', error: 'Connection failed' }
            : t
        ));
      };
      
      ws.onclose = () => {
        clearTimeout(timeout);
      };
      
    } catch (error) {
      setTests(prev => prev.map(t => 
        t.id === testId 
          ? { ...t, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
          : t
      ));
    } finally {
      setIsRunning(false);
    }
  };

  const clearTests = () => {
    setTests([]);
  };

  const getStatusBadge = (status: ConnectionTest['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Success</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>WebSocket Connection Debug</CardTitle>
          <CardDescription>
            Test WebSocket connections and debug URL construction issues
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button onClick={runTest} disabled={isRunning}>
              {isRunning ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="outline" onClick={clearTests}>
              Clear Tests
            </Button>
          </div>
          
          <div className="space-y-2">
            <h3 className="font-semibold">Connection Tests:</h3>
            {tests.length === 0 ? (
              <p className="text-muted-foreground">No tests run yet</p>
            ) : (
              <div className="space-y-2">
                {tests.map((test) => (
                  <div key={test.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(test.status)}
                        <span className="text-sm font-mono">{test.url}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {test.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    {test.error && (
                      <p className="text-sm text-red-600 mt-1">{test.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">Debug Info:</h4>
            <div className="text-sm space-y-1">
              <p><strong>Current URL:</strong> {getWebSocketUrl('/ws')}</p>
              <p><strong>URL Valid:</strong> {validateWebSocketUrl(getWebSocketUrl('/ws')) ? 'Yes' : 'No'}</p>
              <p><strong>Window Location:</strong> {typeof window !== 'undefined' ? window.location.href : 'N/A'}</p>
              <p><strong>Host:</strong> {typeof window !== 'undefined' ? window.location.host : 'N/A'}</p>
              <p><strong>Protocol:</strong> {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h4 className="font-semibold mb-2 text-red-800 dark:text-red-200">Test External WebSocket Blocking:</h4>
            <div className="space-y-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('Testing invalid WebSocket connection...');
                  try {
                    new WebSocket('ws://localhost:undefined/?token=test');
                  } catch (error) {
                    console.log('Expected error:', error);
                  }
                }}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Test Invalid WebSocket (should be blocked)
              </Button>
              <p className="text-xs text-red-600 dark:text-red-400">
                This should be blocked by our protection system. Check the console for details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
