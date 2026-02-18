import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from './Login';
import { MyContext } from './useContext/authContext';

// Mock loginApi
jest.mock('./services/auth/auth', () => ({
  loginApi: jest.fn(),
}));

const mockShowToast = jest.fn();
jest.mock('./hooks/useToast', () => () => mockShowToast);

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const { loginApi } = require('./services/auth/auth');

const renderLogin = (setUser = jest.fn()) => {
  return render(
    <MyContext.Provider value={{ user: false, setUser }}>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </MyContext.Provider>
  );
};

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  test('renders login form', () => {
    renderLogin();
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  test('shows contact admin text', () => {
    renderLogin();
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByText('Contact Admin')).toBeInTheDocument();
  });

  test('email and password inputs are editable', () => {
    renderLogin();
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'secret123' } });

    expect(emailInput.value).toBe('test@example.com');
    expect(passwordInput.value).toBe('secret123');
  });

  test('successful login sets localStorage and navigates', async () => {
    const mockSetUser = jest.fn();
    loginApi.mockResolvedValue({
      data: {
        data: {
          user: {
            id: 1,
            username: 'admin',
            email: 'admin@test.com',
            firstName: 'Admin',
            isSuperuser: true,
            isStaff: true,
          },
        },
      },
    });

    renderLogin(mockSetUser);

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password' } });
    fireEvent.click(screen.getByText('Log In'));

    await waitFor(() => {
      expect(loginApi).toHaveBeenCalledWith({ email: 'admin@test.com', password: 'password' });
    });

    await waitFor(() => {
      expect(localStorage.getItem('isAuthenticated')).toBe('true');
    });

    const userInfo = JSON.parse(localStorage.getItem('userInfo'));
    expect(userInfo.username).toBe('admin');
    expect(userInfo.isSuperuser).toBe(true);
    expect(mockSetUser).toHaveBeenCalledWith(true);
    expect(mockNavigate).toHaveBeenCalledWith('/projects');
  });

  test('failed login shows error toast', async () => {
    loginApi.mockRejectedValue(new Error('Invalid'));

    renderLogin();

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByText('Log In'));

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith('Invalid email or password', { type: 'error' });
    });
  });

  test('submit button shows loading text while API is in progress', async () => {
    loginApi.mockReturnValue(new Promise(() => {})); // Never resolves

    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@test.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pass' } });
    fireEvent.click(screen.getByText('Log In'));

    await waitFor(() => {
      expect(screen.getByText('Please wait ...')).toBeInTheDocument();
    });
  });
});
