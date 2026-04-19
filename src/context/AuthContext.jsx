import React, { createContext, useEffect, useState } from 'react';
import { apiClient } from '../services/apiService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(apiClient.getToken());

  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = apiClient.getStoredUser();
      const storedToken = apiClient.getToken();

      if (storedUser && storedToken) {
        setUser(storedUser);
        setToken(storedToken);
        setLoading(false);

        try {
          const session = await apiClient.restoreSession();
          if (session?.user) {
            setUser(session.user);
            setToken(session.token || storedToken);
          }
        } catch {
          apiClient.logout();
          setUser(null);
          setToken(null);
        }
      } else {
        try {
          const session = await apiClient.restoreSession();
          setUser(session?.user || null);
          setToken(session?.token || null);
        } catch {
          setUser(null);
          setToken(null);
        } finally {
          setLoading(false);
        }

        return;
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const syncUser = (event) => {
      setUser(event.detail);
    };

    window.addEventListener(apiClient.USER_SYNC_EVENT, syncUser);
    return () => window.removeEventListener(apiClient.USER_SYNC_EVENT, syncUser);
  }, []);

  const login = async (email, password) => {
    const result = await apiClient.login(email, password);
    if (result.error) {
      throw new Error(result.error);
    }

    if (result.user && result.token) {
      setToken(result.token);
      setUser(result.user);
      apiClient.setToken(result.token);
      return true;
    }

    throw new Error('Invalid login response');
  };

  const loginDemo = async () => {
    const result = await apiClient.loginDemo();
    if (result.error) {
      throw new Error(result.error);
    }

    if (result.user && result.token) {
      setToken(result.token);
      setUser(result.user);
      apiClient.setToken(result.token);
      return true;
    }

    throw new Error('Invalid demo login response');
  };

  const register = async (username, email, password) => {
    const result = await apiClient.register(username, email, password);
    if (result.error) {
      throw new Error(result.error);
    }

    if (result.user && result.token) {
      setToken(result.token);
      setUser(result.user);
      apiClient.setToken(result.token);
      return true;
    }

    throw new Error('Invalid registration response');
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, loading, login, loginDemo, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
