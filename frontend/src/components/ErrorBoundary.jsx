import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('💥 Keryx UI Crash Captured:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.removeItem('fl_session_v3');
    localStorage.removeItem('fl_offline_queue');
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          background: '#1c1c1e',
          color: '#fff',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h1 style={{ color: '#ff3b30', fontSize: '22px', margin: '0 0 12px 0' }}>Something went wrong</h1>
          <p style={{ color: '#8e8e93', maxWidth: '400px', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
            We prevented a screen freeze! This usually happens due to a temporary network hiccup or cached session.
          </p>
          
          <div style={{
            background: '#2c2c2e', padding: '12px', borderRadius: '8px', maxWidth: '90%',
            overflow: 'auto', textAlign: 'left', fontSize: '12px', color: '#ff9500', marginBottom: '20px',
            fontFamily: 'monospace', border: '1px solid #3a3a3c'
          }}>
            {this.state.error && this.state.error.toString()}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#007aff', color: '#fff', border: 'none', padding: '10px 20px',
                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
              }}
            >
              🔄 Reload App
            </button>
            <button
              onClick={this.handleReset}
              style={{
                background: '#ff3b30', color: '#fff', border: 'none', padding: '10px 20px',
                borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px'
              }}
            >
              🗑️ Clear Session & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
