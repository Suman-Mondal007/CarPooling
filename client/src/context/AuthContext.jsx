import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api/auth.api.js';
import { setAccessToken, onAuthFailure } from '../api/axios.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setTokenState] = useState(null);
  const [loading, setLoading] = useState(true);

  const handleSetAccessToken = useCallback((token) => {
    setTokenState(token);
    setAccessToken(token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      handleSetAccessToken(null);
      setUser(null);
    }
  }, [handleSetAccessToken]);

  // Handle session restore on app mount
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const res = await authApi.refresh();
        if (isMounted && res?.data?.accessToken && res?.data?.user) {
          handleSetAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch {
        // Session could not be restored (not logged in, expired cookie, etc.)
        if (isMounted) {
          handleSetAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    // Register failure callback from Axios interceptor
    const unsubscribe = onAuthFailure(() => {
      if (isMounted) {
        handleSetAccessToken(null);
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [handleSetAccessToken]);

  const login = async (credentials) => {
    const res = await authApi.login(credentials);
    if (res?.data?.accessToken && res?.data?.user) {
      handleSetAccessToken(res.data.accessToken);
      setUser(res.data.user);
    }
    return res;
  };

  const register = async (data) => {
    return await authApi.register(data);
  };

  const updateUser = (updatedUser) => {
    setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  const value = {
    user,
    accessToken,
    loading,
    isAuthenticated: Boolean(user && accessToken),
    isCompanyAdmin: user?.role === 'COMPANY_ADMIN',
    isEmployee: user?.role === 'EMPLOYEE',
    login,
    register,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
