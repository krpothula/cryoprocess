import React, { Component } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

class DashboardErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(`[DashboardError] ${this.props.name || 'Unknown'}:`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '300px',
          padding: '32px',
          textAlign: 'center',
          background: 'var(--color-bg-card)',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            background: 'var(--color-danger-bg)',
            color: 'var(--color-danger-text)',
            marginBottom: '16px',
          }}>
            <FiAlertTriangle size={28} />
          </div>
          <p style={{
            fontSize: '15px',
            fontWeight: 600,
            color: 'var(--color-text)',
            margin: '0 0 6px 0',
          }}>
            {this.props.name ? `${this.props.name} dashboard` : 'Dashboard'} failed to load
          </p>
          <p style={{
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            margin: '0 0 16px 0',
            maxWidth: '400px',
            lineHeight: 1.5,
          }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--color-primary)',
              background: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              cursor: 'pointer',
            }}
          >
            <FiRefreshCw size={14} />
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default DashboardErrorBoundary;
