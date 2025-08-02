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

  useEffect(() => {
    derivAPI.connect().catch(console.error);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_token');
    const savedLoginMethod = localStorage.getItem('deriv_login_method') as 'oauth' | 'token' | null;

    const restoreSession = async () => {
      if (savedToken) {
        try {
          await handleTokenLogin(savedToken, savedLoginMethod || 'token');
        } catch (error) {
          console.error('Failed to restore session:', error);
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    restoreSession(); // ✅ async wrapper fixes the Vite error
  }, []);

  const handleTokenLogin = async (authToken: string, method: 'oauth' | 'token' = 'token') => {
    try {
      setIsLoading(true);
      if (!derivAPI.getConnectionStatus()) {
        await derivAPI.connect();
        await new Promise(resolve => setTimeout(resolve, 1000)); // ✅ allowed inside async fn
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
          country: response.authorize.country
        };

        if (response.authorize.account_list && method === 'oauth') {
          const accounts: AccountListItem[] = response.authorize.account_list.map((account: any) => ({
            loginid: account.loginid,
            currency: account.currency,
            is_virtual: account.is_virtual,
            balance: account.balance || 0,
            email: account.email,
            account_type: account.account_type,
            broker: account.broker,
            is_disabled: account.is_disabled,
            landing_company_name: account.landing_company_name
          }));
          setAccountList(accounts);

          const initialBalances: Record<string, number> = {};
          accounts.forEach(account => {
            initialBalances[account.loginid] = account.balance || 0;
          });
          setAccountBalances(initialBalances);
        } else if (method === 'token') {
          setAccountList(null);
          setAccountBalances({});
        }

        setUser(userData);
        setToken(authToken);
        setLoginMethod(method);
        setIsAuthenticated(true);
        localStorage.setItem('deriv_token', authToken);
        localStorage.setItem('deriv_login_method', method);
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

  const login = async (authToken: string) => {
    await handleTokenLogin(authToken, 'token');
  };

  const loginWithOAuth = async (authToken: string) => {
    await handleTokenLogin(authToken, 'oauth');
  };

  const switchAccount = async (loginid: string) => {
    if (!isAuthenticated || !token || loginMethod !== 'oauth') {
      throw new Error('Not authenticated');
    }

    try {
      setIsLoading(true);
      const response = await derivAPI.sendRequest({
        authorize: token,
        loginid: loginid
      });

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

        setAccountBalances(prev => ({
          ...prev,
          [loginid]: response.authorize.balance
        }));

        setAccountList(prevList =>
          prevList
            ? prevList.map(acc =>
                acc.loginid === loginid
                  ? { ...acc, balance: response.authorize.balance }
                  : acc
              )
            : prevList
        );
      } else {
        throw new Error('Failed to switch account - no authorization response');
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
        [user.loginid]: balance
      }));

      setAccountList(prevList =>
        prevList
          ? prevList.map(acc =>
              acc.loginid === user.loginid ? { ...acc, balance } : acc
            )
          : prevList
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
    logout,
    updateBalances,
    switchAccount
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
