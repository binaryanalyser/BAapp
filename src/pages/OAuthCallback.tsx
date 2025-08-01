import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

const OAuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Get token from URL parameters
      const token = searchParams.get('token');
      const error = searchParams.get('error');

      if (error) {
        console.error('OAuth error:', error);
        navigate('/login?error=' + encodeURIComponent(error));
        return;
      }

      if (token) {
        try {
          await login(token);
          // Redirect to the original URL or dashboard
          const redirectUrl = localStorage.getItem('oauth_redirect_url') || '/';
          localStorage.removeItem('oauth_redirect_url');
          navigate(redirectUrl);
        } catch (err) {
          console.error('Login failed:', err);
          navigate('/login?error=' + encodeURIComponent('Login failed'));
        }
      } else {
        navigate('/login?error=' + encodeURIComponent('No token received'));
      }
    };

    handleOAuthCallback();
  }, [searchParams, login, navigate]);

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