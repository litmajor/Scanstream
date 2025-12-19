import React from 'react';

type State = { hasError: boolean; error?: Error | null; info?: React.ErrorInfo | null };
type Props = { children: React.ReactNode; fallback?: React.ReactNode; onReset?: () => void };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log in development; replace with Sentry/remote logger as needed
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary] captured error:', error, info);
    }
    this.setState({ info });
  }

  reset() {
    this.setState({ hasError: false, error: null, info: null });
    if (this.props.onReset) this.props.onReset();
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <div className="p-6 bg-red-900 text-white rounded">
          <h3 className="text-lg font-bold">Something went wrong</h3>
          <div className="mt-2 text-sm">{this.state.error?.message}</div>
          <div className="mt-4">
            <button onClick={this.reset} className="px-3 py-1 bg-white text-black rounded">Retry</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
