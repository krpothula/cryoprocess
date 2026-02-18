import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AdminUsage from './Usage';

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }) => <div data-testid="chart-container">{children}</div>,
  };
});

// Mock the usage API
jest.mock('../../services/usageApi', () => ({
  getUsageReport: jest.fn(),
  downloadUsageCsv: jest.fn(),
}));

const mockShowToast = jest.fn();
jest.mock('../../hooks/useToast', () => () => mockShowToast);

const { getUsageReport, downloadUsageCsv } = require('../../services/usageApi');

const mockUsageData = {
  data: {
    rows: [
      { username: 'alice', name: 'Alice Smith', totalJobs: 10, successfulJobs: 8, failedJobs: 2, totalHours: 24.5 },
      { username: 'bob', name: 'Bob Jones', totalJobs: 5, successfulJobs: 5, failedJobs: 0, totalHours: 12.0 },
    ],
    totals: { totalJobs: 15, successfulJobs: 13, failedJobs: 2, totalHours: 36.5 },
    dateRange: { start: '2025-12-01T00:00:00.000Z', end: '2026-01-01T00:00:00.000Z' },
    groupBy: 'user',
  },
};

describe('AdminUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUsageReport.mockResolvedValue(mockUsageData);
  });

  test('renders header and controls', async () => {
    render(<AdminUsage />);
    expect(screen.getByText('Usage Report')).toBeInTheDocument();
    expect(screen.getByText('By User')).toBeInTheDocument();
    expect(screen.getByText('By Project')).toBeInTheDocument();
    expect(screen.getByText('By Month')).toBeInTheDocument();
    expect(screen.getByText('Export CSV')).toBeInTheDocument();
  });

  test('shows loading state', () => {
    getUsageReport.mockReturnValue(new Promise(() => {}));
    render(<AdminUsage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('displays summary cards after loading', async () => {
    render(<AdminUsage />);
    await waitFor(() => {
      expect(screen.getByText('36.5h')).toBeInTheDocument();
    });
    // Summary card labels may also appear as table headers, so scope to .usage-card elements
    const cards = document.querySelectorAll('.usage-card');
    expect(cards.length).toBe(4);
    expect(cards[0].textContent).toContain('Total Compute');
    expect(cards[0].textContent).toContain('36.5h');
  });

  test('displays data table with user rows', async () => {
    render(<AdminUsage />);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('24.5h')).toBeInTheDocument();
  });

  test('switching group-by triggers new fetch', async () => {
    render(<AdminUsage />);
    await waitFor(() => {
      expect(getUsageReport).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('By Project'));
    await waitFor(() => {
      expect(getUsageReport).toHaveBeenCalledTimes(2);
    });
    // Verify groupBy parameter was updated
    const lastCall = getUsageReport.mock.calls[1][0];
    expect(lastCall.groupBy).toBe('project');
  });

  test('export CSV button calls downloadUsageCsv', async () => {
    downloadUsageCsv.mockResolvedValue();
    render(<AdminUsage />);
    await waitFor(() => {
      expect(screen.getByText('36.5h')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Export CSV'));
    await waitFor(() => {
      expect(downloadUsageCsv).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('CSV downloaded', { type: 'success' });
    });
  });

  test('shows empty state when no data', async () => {
    getUsageReport.mockResolvedValue({
      data: { rows: [], totals: { totalJobs: 0, successfulJobs: 0, failedJobs: 0, totalHours: 0 } },
    });

    render(<AdminUsage />);
    await waitFor(() => {
      expect(screen.getByText('No usage data for the selected period.')).toBeInTheDocument();
    });
  });

  test('shows error toast on API failure', async () => {
    getUsageReport.mockRejectedValue({
      response: { data: { message: 'Unauthorized' } },
    });

    render(<AdminUsage />);
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Unauthorized', { type: 'error' });
    });
  });
});
