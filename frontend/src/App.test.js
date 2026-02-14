import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MyContext } from './useContext/authContext';
import Login from './Login';

// Mock axios (ESM module) before it's imported through the dependency chain
jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { response: { use: jest.fn() } },
  }),
}));

// Mock services that use axios
jest.mock('./services/auth/auth', () => ({
  loginApi: jest.fn(),
}));

// Mock useToast to avoid react-toastify issues
jest.mock('./hooks/useToast', () => () => jest.fn());

// Test core app behavior without importing App directly,
// which pulls in lazy-loaded components with ESM dependencies.
describe('App core', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Login page renders for unauthenticated users', () => {
    render(
      <MyContext.Provider value={{ user: false, setUser: jest.fn() }}>
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      </MyContext.Provider>
    );
    expect(screen.getByText('Login')).toBeInTheDocument();
    expect(screen.getByText('Log In')).toBeInTheDocument();
  });

  test('isAuthenticated returns false when not logged in', () => {
    const { isAuthenticated } = require('./utils/auth');
    expect(isAuthenticated()).toBe(false);
  });

  test('isAuthenticated returns true after login', () => {
    localStorage.setItem('isAuthenticated', 'true');
    const { isAuthenticated } = require('./utils/auth');
    expect(isAuthenticated()).toBe(true);
  });
});
