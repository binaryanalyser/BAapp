import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, BarChart3, ExternalLink, UserPlus } from 'lucide-react';

const Login: React.FC = () => {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, loginWithOAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for OAuth errors in URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const oauthError = urlParams.get('error');
    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    }
  }, [location]);

  const handleDerivLogin = () => {
    // Store current URL for redirect after OAuth
    localStorage.setItem('oauth_redirect_url', window.location.origin + '/');
    const redirectUri = 'https://binaryanalyser.com/oauth-callback';
    
    // Try multiple OAuth configurations
    const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=88454&affiliate_token=Yqc93056kqBB4VdSfJsOp2Nd7ZgqdRLk/1/&l=EN&brand=deriv&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=read,trade`;
    
    console.log('OAuth Redirect URI:', redirectUri);
    console.log('Full OAuth URL:', authUrl);
    console.log('Current origin:', window.location.origin);
    
    window.location.href = authUrl;
  };

  const handleDerivSignup = () => {
    const signupUrl = 'https://track.deriv.be/_Yqc93056kqA5TVC3w-F7AGNd7ZgqdRLk/1/';
    window.open(signupUrl, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await login(token); // This is API token login
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('Login error:', err);
      
      // Provide more user-friendly error messages
      if (errorMessage.includes('InvalidToken')) {
        setError('Invalid API token. Please check your token and try again.');
      } else if (errorMessage.includes('connection')) {
        setError('Connection failed. Please check your internet connection and try again.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <img src="/welcom_logo.png" alt="Binary Analyzer" className="h-[45px] w-[45px]" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-white">
            Welcome to AI Powered LDP Binary Analyzer
          </h1>
          <h2 className="mt-2 text-sm text-gray-400">
            Get Analysis of Deriv Digits, AI Trading Signals and Indept Analytics of your trading
          </h2>
        </div>

        <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
          {/* OAuth Login Section */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-white mb-4 text-center"> Connect your Deriv account </h3>
            <button
              onClick={handleDerivLogin}
              className="w-full flex items-center justify-center space-x-3 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-md transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Login with Deriv</span>
              <ExternalLink className="h-4 w-4" />
            </button>
            
            <div className="mt-4 text-center">
              <span className="text-gray-400 text-sm">Don't have a Deriv account? </span>
              <button
                onClick={handleDerivSignup}
                className="inline-flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>Sign up here</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-800 text-gray-400">Or use API token</span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-300">
                Deriv API Token
              </label>
              <div className="mt-1 relative">
                <input
                  id="token"
                  name="token"
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  className="appearance-none relative block w-full px-3 py-2 pr-10 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your Deriv API token"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? (
                    <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-300" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400 hover:text-gray-300" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || !token.trim()}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Connecting...' : 'Connect Account'}
              </button>
            </div>
          </form>

          <div className="mt-6 border-t border-gray-700 pt-6">
            <div className="text-sm text-gray-400">
              <p className="mb-2">Need to create an API token?</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Visit <a href="https://track.deriv.be/_Yqc93056kqA5TVC3w-F7AGNd7ZgqdRLk/143/" className="text-blue-400 hover:text-blue-300" target="_blank" rel="noopener noreferrer">app.deriv.com</a></li>
                <li>Go to Settings → API Token</li>
                <li>Create a new token with trading permissions</li>
                <li>Copy and paste it above</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-xs text-gray-400 leading-relaxed">
            <p className="mb-2">
              The products offered on the Deriv.com website include binary options, contracts for difference ("CFDs") and other complex derivatives.
            </p>
            <p className="mb-2">
              Trading binary options may not be suitable for everyone. Trading CFDs carries a high level of risk since leverage can work both to your advantage and disadvantage.
            </p>
            <p className="mb-2">
              As a result, the products offered on the website may not be suitable for all investors because of the risk of losing all of your invested capital.
            </p>
            <p>
              You should never invest money that you cannot afford to lose, and never trade with borrowed money. Before trading in the complex products offered,
              please be sure to understand the risks involved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;