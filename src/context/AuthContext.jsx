/* eslint-disable react-refresh/only-export-components -- context exports Provider and useAuth */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { API_URL } from '../api/client';
import { AGENT_STATUS, agentLoginBlockedMessage, fetchAgentApprovalStatus, fetchSeniorAgentStatus } from '../constants/agentApprovalStatus';

export const AuthContext = createContext(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    setUser(null);
  };

  // Load user from localStorage; block agent sessions when not accepted
  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedRole = localStorage.getItem('role');
        if (storedUser && storedRole) {
          const parsed = JSON.parse(storedUser);
          if (storedRole === 'agent') {
            const status = await fetchAgentApprovalStatus({ id: parsed.id, email: parsed.email });
            const s = (status || '').toLowerCase();
            if (s !== AGENT_STATUS.ACCEPTED && s !== 'active') {
              clearSession();
              return;
            }
            const isSeniorAgent = await fetchSeniorAgentStatus(parsed.id);
            setUser({ ...parsed, role: storedRole, is_senior_agent: isSeniorAgent });
            return;
          }
          setUser({ ...parsed, role: storedRole });
        }
      } catch (err) {
        console.error('AuthProvider init failed:', err);
        clearSession();
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // LOGIN
  const login = async (email, password, role) => {
    if (!email || !password || !role) return { success: false, error: 'Email, password, and role are required' };

    try {
      // For agents, check approval status from Supabase FIRST (source of truth)
      if (role === 'agent') {
        const status = await fetchAgentApprovalStatus({ email });
        const s = (status || '').toLowerCase();
        console.log('Agent approval status (pre-login):', status);

        if (!status) {
          return { success: false, error: 'Agent account not found. Please register first.' };
        }
        if (s !== AGENT_STATUS.ACCEPTED && s !== 'active') {
          return { success: false, error: agentLoginBlockedMessage(status) };
        }
      }

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role })
      });

      const result = await response.json();

      if (!response.ok) {
        if (role === 'agent') {
          // Agent is already confirmed accepted above — backend may have stale status.
          // Filter out stale approval-related errors from the backend.
          const errLower = (result.error || '').toLowerCase();
          if (errLower.includes('pending') || errLower.includes('approval') || errLower.includes('approved') || errLower.includes('not active')) {
            return { success: false, error: 'Invalid email or password' };
          }
        }
        return { success: false, error: result.error || 'Invalid credentials' };
      }

      // Save user and role in localStorage
      localStorage.setItem('user', JSON.stringify(result.user));
      localStorage.setItem('role', role);
      localStorage.setItem('token', result.token);

      let isSeniorAgent = false;
      if (role === 'agent') {
        isSeniorAgent = await fetchSeniorAgentStatus(result.user.id);
      }
      setUser({ ...result.user, role, is_senior_agent: isSeniorAgent });
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
        url = `${API_URL}/auth/register/agent`;
        options = {
          method: 'POST',
          body: data // FormData including profile_photo
        };
      } else if (role === 'customer') {
        url = `${API_URL}/auth/register/customer`;
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        };
      } else if (role === 'partner') {
        url = `${API_URL}/auth/register/partner`;
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
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
