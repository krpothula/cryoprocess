import { isAuthenticated } from './auth';

describe('isAuthenticated', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns false when nothing in localStorage', () => {
    expect(isAuthenticated()).toBe(false);
  });

  test('returns true when isAuthenticated is "true"', () => {
    localStorage.setItem('isAuthenticated', 'true');
    expect(isAuthenticated()).toBe(true);
  });

  test('returns false when isAuthenticated is "false"', () => {
    localStorage.setItem('isAuthenticated', 'false');
    expect(isAuthenticated()).toBe(false);
  });

  test('returns false when isAuthenticated is random string', () => {
    localStorage.setItem('isAuthenticated', 'maybe');
    expect(isAuthenticated()).toBe(false);
  });
});
