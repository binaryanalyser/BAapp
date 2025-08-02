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
        console.log('OAuth callback - Full URL:', window.location.href);
        console.log('OAuth callback - Hash:', window.location.hash);
        console.log('OAuth callback - Search:', window.location.search);
        
        // Try to get token from hash first (OAuth 2.0 implicit flow)
        let token = null;
        let error = null;
        let errorDescription = null;
        
        if (window.location.hash) {
          const hash = window.location.hash.substring(1);
          const hashParams = new URLSearchParams(hash);
          token = hashParams.get('access_token') || hashParams.get('token');
          error = hashParams.get('error');
          errorDescription = hashParams.get('error_description');
          console.log('Hash params:', { token: token ? 'present' : 'missing', error, errorDescription });
        }
        
        // Fallback to query parameters
        if (!token && !error) {
          const searchParams = new URLSearchParams(window.location.search);
          token = searchParams.get('access_token') || searchParams.get('token');
          error = searchParams.get('error');
          errorDescription = searchParams.get('error_description');
          console.log('Search params:', { token: token ? 'present' : 'missing', error, errorDescription });
        }
        
        // Additional fallback - check if there's any token-like parameter
        if (!token && !error) {
          const allParams = new URLSearchParams(window.location.hash.substring(1));
          for (const [key, value] of allParams.entries()) {
            console.log('Hash param:', key, '=', value);
            if (key.includes('token') || key.includes('access')) {
              token = value;
              break;
            }
          }
        }

        if (error) {
          console.error('OAuth error:', error, errorDescription);
          navigate('/login?error=' + encodeURIComponent(errorDescription || error), { replace: true });
          return;
        }

        if (token) {
          console.log('Token received, attempting login...', token.substring(0, 10) + '...');
          await login(token);
          console.log('Login successful, redirecting...');
          
          // Redirect to the original URL or dashboard
          const redirectUrl = localStorage.getItem('oauth_redirect_url') || '/';
          localStorage.removeItem('oauth_redirect_url');
          navigate(redirectUrl, { replace: true });
        } else {
          console.error('No token received in OAuth callback');
          navigate('/login?error=' + encodeURIComponent('No authentication token received. Please try again.'), { replace: true });
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        navigate('/login?error=' + encodeURIComponent(errorMessage));
      }
    };

    // Add a small delay to ensure the URL is fully loaded
    const timer = setTimeout(handleOAuthCallback, 100);
    return () => clearTimeout(timer);
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