import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { derivAPI } from '../services/derivAPI';

interface User {
  loginid: string;
  email: string;
  currency: string;
  balance: number;
  country: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  error: string | null;
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const login = async (token: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await derivAPI.authorize(token);
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      const balance = await derivAPI.getBalance();
      setUser({
        loginid: response.authorize.loginid,
        email: response.authorize.email,
        currency: response.authorize.currency,
        balance: balance.balance?.balance || 0,
        country: response.authorize.country
      });
      
      // Store token for persistence
      localStorage.setItem('deriv_token', token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setError(null);
    derivAPI.disconnect();
    localStorage.removeItem('deriv_token');
    localStorage.removeItem('user_session');
  };

  // Initialize auth state from localStorage on app start
  useEffect(() => {
    const initializeAuth = async () => {
      if (isInitialized) return; // Prevent multiple initializations
      
      setIsRestoring(true);
      try {
        const token = localStorage.getItem('deriv_token');
        const savedSession = localStorage.getItem('user_session');
        
        if (token && savedSession) {
          try {
            const sessionData = JSON.parse(savedSession);
            
            // Restore session immediately without API verification
            setUser(sessionData);
            console.log('Session restored from localStorage');
            
            // Verify token in background and update if needed (but don't logout on failure)
            setTimeout(() => {
              derivAPI.authorize(token).then(response => {
                if (!response.error) {
                  // Update balance if token is valid
                  derivAPI.getBalance().then(balanceResponse => {
                    if (balanceResponse.balance) {
                      setUser(prev => prev ? {
                        ...prev,
                        balance: balanceResponse.balance.balance
                      } : null);
                    }
                  }).catch(error => {
                    console.warn('Balance update failed:', error);
                  });
                } else {
                  console.warn('Token verification failed in background:', response.error.message);
                  // Don't logout automatically - let user continue with cached session
                }
              }).catch(error => {
                console.warn('Background token verification failed:', error);
                // Don't logout on network errors
              });
            }, 2000); // Delay background verification
            
          } catch (parseError) {
            console.error('Failed to parse saved session, clearing:', parseError);
            localStorage.removeItem('deriv_token');
            localStorage.removeItem('user_session');
            setUser(null);
          }
        } else if (token) {
          // Have token but no session, try to login
          try {
            const response = await derivAPI.authorize(token);
            if (response.error) {
              console.warn('Auto-login failed:', response.error.message);
              localStorage.removeItem('deriv_token');
            } else {
              const balance = await derivAPI.getBalance();
              const userData = {
                loginid: response.authorize.loginid,
                email: response.authorize.email,
                currency: response.authorize.currency,
                balance: balance.balance?.balance || 0,
                country: response.authorize.country
              };
              
              setUser(userData);
              console.log('Auto-login successful');
            }
          } catch (loginError) {
            console.warn('Auto-login failed:', loginError);
            localStorage.removeItem('deriv_token');
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error);
      } finally {
        setIsRestoring(false);
        setIsInitialized(true);
      }
    };

    if (!isInitialized) {
      initializeAuth();
    }
  }, [isInitialized]);

  // Persist user session data
  useEffect(() => {
    if (user) {
      localStorage.setItem('user_session', JSON.stringify(user));
    }
  }, [user]);

  // Handle page visibility change to reconnect WebSocket only
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && !isRestoring) {
        // Only reconnect WebSocket, don't re-authenticate
        derivAPI.connect().catch(error => {
          console.warn('Failed to reconnect WebSocket on visibility change:', error);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, isRestoring]);

  // Add session timeout handling (optional - only logout after extended inactivity)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const resetTimeout = () => {
      clearTimeout(timeoutId);
      // Set a very long timeout (4 hours) before considering logout
      timeoutId = setTimeout(() => {
        console.log('Session timeout - user inactive for 4 hours');
        // Only logout if there's been no activity for a very long time
        logout();
      }, 4 * 60 * 60 * 1000); // 4 hours
    };

    const handleActivity = () => {
      if (user) {
        resetTimeout();
      }
    };

    if (user) {
      resetTimeout();
      // Listen for user activity
      window.addEventListener('mousedown', handleActivity);
      window.addEventListener('keydown', handleActivity);
      window.addEventListener('scroll', handleActivity);
      window.addEventListener('touchstart', handleActivity);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousedown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
    };
  }, [user]);
  const value = {
    user,
    isAuthenticated: !!user,
    isLoading: isRestoring || isLoading,
    login,
    logout,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};