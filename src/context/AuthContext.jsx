/* eslint-disable react-refresh/only-export-components -- context exports Provider and useAuth */
import React, { createContext, useState, useEffect, useContext } from 'react';
import { flushSync } from 'react-dom';
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
  const [impersonation, setImpersonation] = useState(null); // null | { adminName, agentName, expiresAt }

  const clearSession = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('token');
    setUser(null);
  };

  const clearImpersonationMeta = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_role');
    localStorage.removeItem('impersonation_meta');
    setImpersonation(null);
  };

  // Load user from localStorage; block agent sessions when not accepted
  useEffect(() => {
    const init = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        const storedRole = localStorage.getItem('role');
        const storedMeta = localStorage.getItem('impersonation_meta');
        if (storedMeta) {
          try {
            const meta = JSON.parse(storedMeta);
            // Tab was closed/refreshed mid-impersonation — keep the admin in
            // the impersonated view (don't silently drop them back to admin);
            // the expiry/banner flow takes it from here.
            if (meta.expiresAt && new Date(meta.expiresAt) > new Date()) {
              setImpersonation(meta);
            } else {
              clearImpersonationMeta();
            }
          } catch {
            clearImpersonationMeta();
          }
        }
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

  // The API client dispatches this when a request comes back with
  // code: 'IMPERSONATION_EXPIRED' — restore the admin's own session instead
  // of a jarring full logout.
  useEffect(() => {
    const handleExpired = () => {
      restoreAdminSession({ silent: true });
    };
    window.addEventListener('impersonation-expired', handleExpired);
    return () => window.removeEventListener('impersonation-expired', handleExpired);
  }, []);

  const restoreAdminSession = ({ silent } = {}) => {
    const adminToken = localStorage.getItem('admin_token');
    const adminUser = localStorage.getItem('admin_user');
    const adminRole = localStorage.getItem('admin_role');
    if (!adminToken || !adminUser || !adminRole) {
      clearImpersonationMeta();
      if (!silent) clearSession();
      return { success: false };
    }
    localStorage.setItem('token', adminToken);
    localStorage.setItem('user', adminUser);
    localStorage.setItem('role', adminRole);
    flushSync(() => {
      clearImpersonationMeta();
      setUser({ ...JSON.parse(adminUser), role: adminRole });
    });
    return { success: true };
  };

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

  // LOGOUT — signing out while impersonating ends the whole thing, not just
  // a "return to admin" (that's what the dedicated banner button is for).
  const logout = () => {
    if (impersonation) {
      fetch(`${API_URL}/auth/impersonate/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      }).catch(() => {});
      clearImpersonationMeta();
    }
    clearSession();
  };

  // IMPERSONATION: start "Login as Agent"
  const startImpersonation = async (agentId) => {
    if (user?.role !== 'admin') return { success: false, error: 'Only admins can do this.' };
    try {
      const response = await fetch(`${API_URL}/auth/impersonate/${agentId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
      const result = await response.json();
      if (!response.ok) return { success: false, error: result.error || 'Failed to start impersonation' };

      // Stash the admin's real session so "Return to Admin" needs no re-login.
      localStorage.setItem('admin_token', localStorage.getItem('token'));
      localStorage.setItem('admin_user', localStorage.getItem('user'));
      localStorage.setItem('admin_role', localStorage.getItem('role'));

      const meta = { adminName: result.adminName, agentName: result.agent.name, expiresAt: result.expiresAt };
      localStorage.setItem('impersonation_meta', JSON.stringify(meta));

      localStorage.setItem('token', result.impersonationToken);
      localStorage.setItem('user', JSON.stringify(result.agent));
      localStorage.setItem('role', 'agent');

      const isSeniorAgent = await fetchSeniorAgentStatus(result.agent.id);
      // flushSync: the caller navigates immediately after this resolves, and
      // ProtectedRoute reads `user` from context on that very next render.
      // Without a synchronous flush, the route change can commit before this
      // state update does, so ProtectedRoute sees the stale (admin) user,
      // fails the agent-only check, and redirects away before the correct
      // state ever renders.
      flushSync(() => {
        setImpersonation(meta);
        setUser({ ...result.agent, role: 'agent', is_senior_agent: isSeniorAgent });
      });
      return { success: true };
    } catch (err) {
      console.error('Impersonation start error:', err);
      return { success: false, error: 'Unexpected error occurred' };
    }
  };

  // IMPERSONATION: "Return to Admin"
  const endImpersonation = async () => {
    if (!impersonation) return { success: false };
    try {
      await fetch(`${API_URL}/auth/impersonate/end`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      });
    } catch (err) {
      console.error('Impersonation end error:', err);
    }
    return restoreAdminSession();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading, impersonation, startImpersonation, endImpersonation }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
