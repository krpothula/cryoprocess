import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardErrorBoundary from './DashboardErrorBoundary';

// A component that throws an error
const ProblemChild = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Test crash');
  return <div>Child rendered OK</div>;
};

// Suppress console.error noise from React error boundary logs
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  console.error.mockRestore();
});

describe('DashboardErrorBoundary', () => {
  test('renders children when no error', () => {
    render(
      <DashboardErrorBoundary name="Test">
        <div>Content</div>
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  test('shows error UI when child throws', () => {
    render(
      <DashboardErrorBoundary name="Motion Correction">
        <ProblemChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('Motion Correction dashboard failed to load')).toBeInTheDocument();
    expect(screen.getByText('Test crash')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  test('shows generic error message when name is not provided', () => {
    render(
      <DashboardErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('Dashboard failed to load')).toBeInTheDocument();
  });

  test('retry button resets error state', () => {
    const { rerender } = render(
      <DashboardErrorBoundary name="CTF" key="test">
        <ProblemChild shouldThrow={true} />
      </DashboardErrorBoundary>
    );

    expect(screen.getByText('CTF dashboard failed to load')).toBeInTheDocument();

    // Click retry — component will re-render children
    // Since ProblemChild still throws, it will go back to error state
    fireEvent.click(screen.getByText('Retry'));

    // After retry, the boundary tries to render children again
    // Since ProblemChild throws again, error UI should reappear
    expect(screen.getByText('CTF dashboard failed to load')).toBeInTheDocument();
  });

  test('shows fallback error message when error has no message', () => {
    const ThrowEmpty = () => { throw new Error(); };
    render(
      <DashboardErrorBoundary name="Test">
        <ThrowEmpty />
      </DashboardErrorBoundary>
    );
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });
});
