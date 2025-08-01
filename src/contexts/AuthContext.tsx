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

  // Initialize WebSocket connection
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    if (savedToken) {
      handleTokenLogin(savedToken).catch(error => {
        console.error('Failed to restore session:', error);
        // Don't clear token immediately, let user try manual login
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleTokenLogin = async (authToken: string) => {
    try {
      setIsLoading(true);
      
      // Ensure connection is established
      if (!derivAPI.getConnectionStatus()) {
        await derivAPI.connect();
        // Add a small delay to ensure connection is stable
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
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
        console.log('Authentication successful for:', userData.loginid);
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      // Only clear token if it's definitely invalid (not connection issues)
      if (error instanceof Error && error.message.includes('InvalidToken')) {
        localStorage.removeItem('deriv_token');
        setUser(null);
        setToken(null);
        setIsAuthenticated(false);
      } else {
        // For connection issues, keep the token but set loading to false
        console.warn('Connection issue during auth, keeping token for retry');
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (authToken: string) => {
    await handleTokenLogin(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    localStorage.removeItem('deriv_token');
    // Don't disconnect API as it might be used by other parts of the app
    console.log('User logged out');
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