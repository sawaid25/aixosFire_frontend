import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedRole = localStorage.getItem('role');
    if (storedUser && storedRole) {
      setUser({ ...JSON.parse(storedUser), role: storedRole });
    }
    setLoading(false);
  }, []);

  // LOGIN
  const login = async (email, password, role) => {
    if (!email || !password || !role) return { success: false, error: 'Email, password, and role are required' };

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || 'Invalid credentials' };
      }

      // Save user and role in localStorage
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('role', role);
      localStorage.setItem('token', result.token);

      setUser({ ...result.user, role });
      return { success: true };
    } catch (err) {
      console.error('Login Error:', err);
      return { success: false, error: 'Unexpected error occurred' };
    }
  };

  // REGISTER
  const register = async (role, data) => {
    if (!role || !data) return { success: false, error: 'Role and data are required' };

    try {
      let url = '';
      let options = {};

      if (role === 'agent') {
        url = 'http://localhost:5000/api/auth/register/agent';
        options = {
          method: 'POST',
          body: data // FormData including profile_photo
        };
      } else if (role === 'customer') {
        url = 'http://localhost:5000/api/auth/register/customer';
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        };
      } else {
        return { success: false, error: 'Invalid role' };
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok) return { success: false, error: result.error || 'Registration failed' };

      return { success: true, data: result };
    } catch (err) {
      console.error('Register Error:', err);
      return { success: false, error: 'Unexpected error occurred' };
    }
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
