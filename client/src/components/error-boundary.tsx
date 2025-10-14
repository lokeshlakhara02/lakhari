import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // In production, you could log to an error tracking service here
    // Example: logErrorToService(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-destructive/5 p-4">
          <div className="max-w-2xl w-full">
            <Alert className="bg-destructive/10 border-destructive/30 shadow-2xl">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-destructive/20 rounded-full flex items-center justify-center">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-destructive mb-2">
                      Oops! Something went wrong
                    </h2>
                    <AlertDescription className="text-base text-muted-foreground mb-4">
                      We encountered an unexpected error. Don't worry, your data is safe.
                      Please try refreshing the page or return to the home page.
                    </AlertDescription>
                  </div>

                  {/* Error Details (Development Only) */}
                  {process.env.NODE_ENV === 'development' && this.state.error && (
                    <div className="bg-background/50 rounded-lg p-4 border border-border">
                      <h3 className="text-sm font-semibold mb-2 text-destructive">
                        Error Details (Development Mode)
                      </h3>
                      <pre className="text-xs overflow-auto max-h-40 text-muted-foreground whitespace-pre-wrap">
                        {this.state.error.toString()}
                        {this.state.errorInfo && (
                          <>
                            {'\n\n'}
                            {this.state.errorInfo.componentStack}
                          </>
                        )}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={this.handleReset}
                      className="flex-1 bg-primary hover:bg-primary/90"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                    <Button
                      onClick={this.handleGoHome}
                      variant="outline"
                      className="flex-1"
                    >
                      <Home className="h-4 w-4 mr-2" />
                      Go Home
                    </Button>
                  </div>

                  {/* Help Text */}
                  <p className="text-xs text-muted-foreground">
                    If this problem persists, please try clearing your browser cache or
                    contact support. Error ID: {Date.now()}
                  </p>
                </div>
              </div>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

