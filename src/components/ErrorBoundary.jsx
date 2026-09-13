import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20,
          fontFamily: 'monospace',
          background: '#1e293b',
          color: '#f8fafc',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <h2 style={{ color: '#f43f5e', margin: 0 }}>⚠ Error en la app</h2>
          <pre style={{
            background: '#0f172a',
            padding: 12,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            color: '#fbbf24'
          }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo && (
            <pre style={{
              background: '#0f172a',
              padding: 12,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 11,
              color: '#94a3b8'
            }}>
              {this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            style={{
              padding: '10px 20px',
              background: '#0062ff',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 14
            }}
          >
            Limpiar y recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
