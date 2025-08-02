// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI, AuthResponse } from '../services/derivAPI';

interface AccountListItem {
  loginid: string;
  currency: string;
  is_virtual: number;
  balance?: number;
  email?: string;
  account_type?: string;
  broker?: string;
  is_disabled?: number;
  landing_company_name?: string;
}

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
  accountList: AccountListItem[] | null;
  loginMethod: 'oauth' | 'token' | null;
  accountBalances: Record<string, number>;
  login: (token: string) => Promise<void>;
  loginWithOAuth: (token: string) => Promise<void>;
  handleTokenLogin: (token: string, method: 'oauth' | 'token') => Promise<void>;
  logout: () => void;
  updateBalance: (balance: number) => void;
  switchAccount: (loginid: string) => Promise<void>;
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
  const [accountList, setAccountList] = useState<AccountListItem[] | null>(null);
  const [loginMethod, setLoginMethod] = useState<'oauth' | 'token' | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  // Connect to Deriv API on mount
  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  // Define handleTokenLogin function
  const handleTokenLogin = async (authToken: string, method: 'oauth' | 'token') => {
    try {
      setIsLoading(true);

      if (!derivAPI.getConnectionStatus()) {
        await derivAPI.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response: AuthResponse = await derivAPI.authorize(authToken);

      if (response.authorize) {
        const userData: User = {
          loginid: response.authorize.loginid,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual,
          country: response.authorize.country,
        };

        setUser(userData);
        setToken(authToken);
        setLoginMethod(method);
        setIsAuthenticated(true);
        localStorage.setItem('deriv_token', authToken);
        localStorage.setItem('deriv_login_method', method);

        if (method === 'oauth' && response.authorize.account_list) {
          const accounts: AccountListItem[] = response.authorize.account_list.map(account => ({
            ...account,
            balance: account.balance ?? 0,
          }));
          setAccountList(accounts);

          const balances: Record<string, number> = {};
          accounts.forEach(account => {
            balances[account.loginid] = account.balance ?? 0;
          });
          setAccountBalances(balances);
        } else {
          setAccountList(null);
          setAccountBalances({ [userData.loginid]: userData.balance });
        }
      }
    } catch (error) {
      console.error('Authorization failed:', error);
      localStorage.removeItem('deriv_token');
      localStorage.removeItem('deriv_login_method');
      setUser(null);
      setToken(null);
      setLoginMethod(null);
      setIsAuthenticated(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-login effect - runs only once on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    const savedLoginMethod = localStorage.getItem('deriv_login_method') as 'oauth' | 'token' | null;

    if (savedToken && savedLoginMethod) {
      handleTokenLogin(savedToken, savedLoginMethod).catch(error => {
        console.error('Failed to restore session:', error);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []); // Empty dependency array - runs only once

  const login = async (authToken: string) => {
    await handleTokenLogin(authToken, 'token');
  };

  const loginWithOAuth = async (authToken: string) => {
    await handleTokenLogin(authToken, 'oauth');
  };

  const switchAccount = async (loginid: string) => {
    if (!isAuthenticated || !token || loginMethod !== 'oauth') {
      throw new Error('Not authenticated or not using OAuth');
    }

    try {
      setIsLoading(true);

      const response = await derivAPI.sendRequest({
        authorize: token,
        loginid,
      });

      if (response.authorize) {
        const userData: User = {
          loginid: response.authorize.loginid,
          email: response.authorize.email,
          fullname: response.authorize.fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          is_virtual: response.authorize.is_virtual,
          country: response.authorize.country,
        };

        setUser(userData);

        setAccountBalances(prev => ({
          ...prev,
          [loginid]: response.authorize.balance,
        }));

        setAccountList(prevList =>
          prevList?.map(acc =>
            acc.loginid === loginid
              ? { ...acc, balance: response.authorize.balance }
              : acc
          ) ?? []
        );
      }
    } catch (error) {
      console.error('Account switch failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setLoginMethod(null);
    setIsAuthenticated(false);
    setAccountList(null);
    setAccountBalances({});
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_login_method');
  };

  const updateBalance = (balance: number) => {
    if (user) {
      setUser({ ...user, balance });
      setAccountBalances(prev => ({
        ...prev,
        [user.loginid]: balance,
      }));

      setAccountList(prevList =>
        prevList?.map(acc =>
          acc.loginid === user.loginid ? { ...acc, balance } : acc
        ) ?? []
      );
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated,
    isLoading,
    accountList,
    loginMethod,
    accountBalances,
    login,
    loginWithOAuth,
    handleTokenLogin,
    logout,
    updateBalance,
    switchAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};