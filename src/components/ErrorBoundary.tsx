import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 mb-4">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            문제가 발생했습니다
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            {this.state.error?.message || '알 수 없는 오류가 발생했습니다.'}
          </p>
          <Button variant="outline" size="sm" onClick={this.handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
