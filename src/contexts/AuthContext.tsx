import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI, AuthResponse } from '../services/derivAPI';

interface User {
  loginid: string;
  email: string;
  fullname: string;
  currency: string;
  balance: number;
  is_virtual: number;
  country: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  updateBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    if (savedToken) {
      // Wait for derivAPI connection before attempting authorization
      const checkConnection = () => {
        if (derivAPI.isConnected()) {
          handleTokenLogin(savedToken);
        } else {
          // Listen for connection status changes
          derivAPI.onConnection((connected) => {
            if (connected && savedToken) {
              handleTokenLogin(savedToken);
            }
          });
        }
      };
      
      checkConnection();
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleTokenLogin = async (authToken: string) => {
    try {
      setIsLoading(true);
      
      // Authorize with the token
      const response: AuthResponse = await derivAPI.authorize(authToken);
      
      if (response.authorize) {
        const userData: User = {
          loginid: response.authorize.loginid,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual,
          country: response.authorize.country
        };

        setUser(userData);
        setToken(authToken);
        setIsAuthenticated(true);
        
        // Save token to localStorage
        localStorage.setItem('deriv_token', authToken);
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      // Clear any saved token if authorization fails
      localStorage.removeItem('deriv_token');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (authToken: string) => {
    // Explicitly connect when user provides a new token
    await derivAPI.connect();
    await handleTokenLogin(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('deriv_token');
    derivAPI.disconnect();
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    logout,
    updateBalance
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};