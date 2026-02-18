import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './index';
import { MyContext } from '../../useContext/authContext';

// Mock theme context
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ isDark: false, toggleTheme: jest.fn(), theme: 'light' }),
}));

// Mock API calls
jest.mock('../../services/projects/projects', () => ({
  getProjectByIdApi: jest.fn().mockResolvedValue({ data: {} }),
}));
jest.mock('../../services/liveSession', () => ({
  getSession: jest.fn().mockResolvedValue({ data: {} }),
}));

// Mock logout
jest.mock('../../utils/session', () => ({
  logout: jest.fn(),
}));

const renderNavbar = (props = {}, userInfo = {}) => {
  localStorage.setItem('userInfo', JSON.stringify({
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    isSuperuser: false,
    isStaff: false,
    ...userInfo,
  }));

  return render(
    <MyContext.Provider value={{ user: true, setUser: jest.fn() }}>
      <BrowserRouter>
        <Navbar
          setShowJobTree={props.setShowJobTree || jest.fn()}
          showJobTree={props.showJobTree || false}
        />
      </BrowserRouter>
    </MyContext.Provider>
  );
};

describe('Navbar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('renders brand name', () => {
    renderNavbar();
    expect(screen.getByText('CryoProcess')).toBeInTheDocument();
  });

  test('shows navigation links', () => {
    renderNavbar();
    expect(screen.getByText('Cluster')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
  });

  test('shows user initials in profile button', () => {
    renderNavbar();
    expect(screen.getByText('TU')).toBeInTheDocument(); // Test User
  });

  test('hides admin links for regular users', () => {
    renderNavbar();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
    expect(screen.queryByText('Usage')).not.toBeInTheDocument();
  });

  test('shows admin links for superuser', () => {
    renderNavbar({}, { isSuperuser: true });
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
  });

  test('shows admin links for staff', () => {
    renderNavbar({}, { isStaff: true });
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Usage')).toBeInTheDocument();
  });

  test('opens profile dropdown on click', () => {
    renderNavbar();
    const profileBtn = screen.getByLabelText('Open profile menu');
    fireEvent.click(profileBtn);

    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('shows theme toggle in dropdown', () => {
    renderNavbar();
    fireEvent.click(screen.getByLabelText('Open profile menu'));
    expect(screen.getByText('Dark Mode')).toBeInTheDocument();
  });

  test('shows role badge in dropdown', () => {
    renderNavbar({}, { isSuperuser: true });
    fireEvent.click(screen.getByLabelText('Open profile menu'));
    expect(screen.getByText('Superuser')).toBeInTheDocument();
  });

  test('shows User role for regular user', () => {
    renderNavbar();
    fireEvent.click(screen.getByLabelText('Open profile menu'));
    expect(screen.getByText('User')).toBeInTheDocument();
  });

  test('shows Staff role for staff user', () => {
    renderNavbar({}, { isStaff: true });
    fireEvent.click(screen.getByLabelText('Open profile menu'));
    expect(screen.getByText('Staff')).toBeInTheDocument();
  });
});
