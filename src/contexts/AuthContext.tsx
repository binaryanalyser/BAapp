import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI, AuthResponse } from '../services/derivAPI';
import { supabaseService } from '../services/supabaseService';
import { User as SupabaseUser } from '../lib/supabase';

interface User {
  loginid: string;
  email: string;
  fullname: string;
  currency: string;
  balance: number;
  is_virtual: number;
  country: string;
  supabaseId?: string;
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
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Check for saved token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    if (savedToken) {
      handleTokenLogin(savedToken);
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

        // Save/update user in Supabase
        const supabaseUserData = await supabaseService.createOrUpdateUser({
          deriv_loginid: response.authorize.loginid,
          deriv_token: authToken,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual === 1,
          country: response.authorize.country
        });

        if (supabaseUserData) {
          setSupabaseUser(supabaseUserData);
          userData.supabaseId = supabaseUserData.id;
        }
        setUser(userData);
        setToken(authToken);
        setIsAuthenticated(true);
        
        // Save token to localStorage
        localStorage.setItem('deriv_token', authToken);
        
        // Create session in Supabase
        if (supabaseUserData) {
          const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
          await supabaseService.createSession(supabaseUserData.id, sessionToken, expiresAt);
          localStorage.setItem('session_token', sessionToken);
        }
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      // Clear any saved token if authorization fails
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('session_token');
      setUser(null);
      setToken(null);
      setIsAuthenticated(false);
      setSupabaseUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (authToken: string) => {
    await handleTokenLogin(authToken);
  };

  const logout = () => {
    // Clean up session in Supabase
    const sessionToken = localStorage.getItem('session_token');
    if (sessionToken) {
      supabaseService.deleteSession(sessionToken);
    }
    
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setSupabaseUser(null);
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('session_token');
    derivAPI.disconnect();
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
      
      // Update balance in Supabase
      if (supabaseUser) {
        supabaseService.updateUserBalance(supabaseUser.id, balance);
      }
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