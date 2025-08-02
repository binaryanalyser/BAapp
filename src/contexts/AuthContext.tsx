import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { derivAPI } from '../services/derivAPI';

interface User {
  loginid: string;
  email: string;
  fullname: string;
  currency: string;
  balance: number;
  is_virtual: number;
  country: string;
}

interface AccountListItem {
  loginid: string;
  currency: string;
  is_virtual: number;
  email: string;
  account_type: string;
  broker: string;
  is_disabled: number;
  landing_company_name: string;
  balance?: number;
}

interface AuthResponse {
  authorize: {
    loginid: string;
    email: string;
    fullname: string;
    currency: string;
    balance: number;
    is_virtual: number;
    country: string;
    account_list?: any[];
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loginMethod: 'oauth' | 'token' | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accountList: AccountListItem[] | null;
  accountBalances: Record<string, number>;
  login: (token: string) => Promise<void>;
  logout: () => void;
  handleTokenLogin: (authToken: string, method?: 'oauth' | 'token') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loginMethod, setLoginMethod] = useState<'oauth' | 'token' | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountList, setAccountList] = useState<AccountListItem[] | null>(null);
  const [accountBalances, setAccountBalances] = useState<Record<string, number>>({});

  const handleTokenLogin = async (authToken: string, method: 'oauth' | 'token' = 'token') => {
    try {
      setIsLoading(true);
      if (!derivAPI.getConnectionStatus()) {
        await derivAPI.connect();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const response: AuthResponse = await derivAPI.authorize(authToken);

      if (!response.authorize) throw new Error('Authorization failed');

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
      setLoginMethod(method);
      setIsAuthenticated(true);
      localStorage.setItem('deriv_token', authToken);
      localStorage.setItem('deriv_login_method', method);

      if (response.authorize.account_list && method === 'oauth') {
        const accounts: AccountListItem[] = response.authorize.account_list.map((account: any) => ({
          loginid: account.loginid,
          currency: account.currency,
          is_virtual: account.is_virtual,
          email: account.email,
          account_type: account.account_type,
          broker: account.broker,
          is_disabled: account.is_disabled,
          landing_company_name: account.landing_company_name
        }));

        const accountBalances: Record<string, number> = {};

        for (const account of accounts) {
          try {
            const res = await derivAPI.sendRequest({
              authorize: authToken,
              loginid: account.loginid
            });

            if (res.authorize) {
              account.balance = res.authorize.balance || 0;
              accountBalances[account.loginid] = account.balance;
            }
          } catch (err) {
            console.warn(`Failed to fetch balance for ${account.loginid}`, err);
          }
        }

        setAccountList(accounts);
        setAccountBalances(accountBalances);
      } else if (method === 'token') {
        setAccountList(null);
        setAccountBalances({});
      }

    } catch (error) {
      console.error('Authorization failed:', error);
      if (error instanceof Error && error.message.includes('InvalidToken')) {
        localStorage.removeItem('deriv_token');
        localStorage.removeItem('deriv_login_method');
        setUser(null);
        setToken(null);
        setLoginMethod(null);
        setIsAuthenticated(false);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (authToken: string) => {
    await handleTokenLogin(authToken, 'token');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setLoginMethod(null);
    setIsAuthenticated(false);
    setAccountList(null);
    setAccountBalances({});
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('deriv_login_method');
    derivAPI.disconnect();
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('deriv_token');
    const storedMethod = localStorage.getItem('deriv_login_method') as 'oauth' | 'token' | null;
    
    if (storedToken && storedMethod) {
      handleTokenLogin(storedToken, storedMethod).catch((error) => {
        console.error('Auto-login failed:', error);
        logout();
      });
    }
  }, []);

  const value: AuthContextType = {
    user,
    token,
    loginMethod,
    isAuthenticated,
    isLoading,
    accountList,
    accountBalances,
    login,
    logout,
    handleTokenLogin
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};