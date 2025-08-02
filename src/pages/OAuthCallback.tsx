import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

const OAuthCallback: React.FC = () => {
  const location = useLocation();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Parse the URL hash for OAuth response
        const hash = location.hash.substring(1);
        const params = new URLSearchParams(hash);
        
        // Get token and other parameters from hash
        const token = params.get('token') || params.get('access_token');
        const error = params.get('error');
        const errorDescription = params.get('error_description');

        console.log('OAuth callback received:', { token: token ? 'present' : 'missing', error, hash });

        if (error) {
          console.error('OAuth error:', error, errorDescription);
          navigate('/login?error=' + encodeURIComponent(errorDescription || error));
          return;
        }

        if (token) {
          console.log('Token received, attempting login...');
          await login(token);
          console.log('Login successful, redirecting...');
          
          // Redirect to the original URL or dashboard
          const redirectUrl = localStorage.getItem('oauth_redirect_url') || '/';
          localStorage.removeItem('oauth_redirect_url');
          navigate(redirectUrl, { replace: true });
        } else {
          console.error('No token received in OAuth callback');
          navigate('/login?error=' + encodeURIComponent('No authentication token received'));
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        navigate('/login?error=' + encodeURIComponent(errorMessage));
      }
    };

    handleOAuthCallback();
  }, [location, login, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <BarChart3 className="h-16 w-16 text-blue-500 animate-pulse" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">
          Completing Login...
        </h2>
        <div className="flex items-center justify-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
          <span className="text-gray-400">Processing authentication...</span>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;