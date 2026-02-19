import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProjectWebhooks from './ProjectWebhooks';

// Mock the API services
jest.mock('../../services/projects/projects', () => ({
  getProjectByIdApi: jest.fn(),
  updateProjectApi: jest.fn(),
}));

// Mock useToast hook
const mockShowToast = jest.fn();
jest.mock('../../hooks/useToast', () => () => mockShowToast);

const { getProjectByIdApi, updateProjectApi } = require('../../services/projects/projects');

const defaultProps = {
  projectId: 'proj-123',
  projectName: 'Test Project',
  onClose: jest.fn(),
};

describe('ProjectWebhooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getProjectByIdApi.mockResolvedValue({
      data: { data: { webhookUrls: [] } },
    });
  });

  test('shows loading state initially', () => {
    getProjectByIdApi.mockReturnValue(new Promise(() => {})); // Never resolves
    render(<ProjectWebhooks {...defaultProps} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  test('renders webhook modal after loading', async () => {
    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('No webhook URLs configured')).toBeInTheDocument();
  });

  test('displays existing webhook URLs', async () => {
    getProjectByIdApi.mockResolvedValue({
      data: { data: { webhookUrls: ['https://hooks.slack.com/services/123'] } },
    });

    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Slack')).toBeInTheDocument();
    });
  });

  test('detects Teams webhook provider', async () => {
    getProjectByIdApi.mockResolvedValue({
      data: { data: { webhookUrls: ['https://webhook.office.com/xxx'] } },
    });

    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Teams')).toBeInTheDocument();
    });
  });

  test('adds a new URL', async () => {
    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/hooks.slack.com/);
    fireEvent.change(input, { target: { value: 'https://hooks.slack.com/test' } });

    // Click the add button (the one with wh-btn-add class)
    const addBtn = document.querySelector('.wh-btn-add');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(screen.getByText('Slack')).toBeInTheDocument();
    });
  });

  test('rejects non-https URL', async () => {
    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/hooks.slack.com/);
    fireEvent.change(input, { target: { value: 'http://insecure.com/webhook' } });

    // Find and click the add button (FiPlus button)
    const buttons = screen.getAllByRole('button');
    const addBtn = buttons.find(b => b.classList.contains('wh-btn-add'));
    if (addBtn) fireEvent.click(addBtn);

    expect(mockShowToast).toHaveBeenCalledWith(
      'Webhook URL must start with https://',
      { type: 'error' }
    );
  });

  test('calls onClose when cancel is clicked', async () => {
    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  test('saves webhook URLs', async () => {
    updateProjectApi.mockResolvedValue({ data: { success: true } });

    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Webhooks')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(updateProjectApi).toHaveBeenCalledWith('proj-123', { webhookUrls: [] });
    });
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Webhook URLs saved', { type: 'success' });
    });
  });

  test('shows error toast on save failure', async () => {
    updateProjectApi.mockRejectedValue({
      response: { data: { message: 'Server error' } },
    });

    render(<ProjectWebhooks {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Server error', { type: 'error' });
    });
  });
});
