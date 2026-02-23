import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

// C5 FIX: error boundary to catch template render crashes

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Ad Creative Generator error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: 24, textAlign: 'center',
          color: 'var(--text-muted)', fontSize: 13,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>&#x26A0;</div>
          <div>Something went wrong rendering this preview.</div>
          <button
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
