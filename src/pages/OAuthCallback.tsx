import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BarChart3 } from 'lucide-react';

const OAuthCallback: React.FC = () => {
  const location = useLocation();
  const { loginWithOAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        console.log('=== DETAILED OAuth Callback Debug Info ===');
        console.log('Full URL:', window.location.href);
        console.log('Protocol:', window.location.protocol);
        console.log('Host:', window.location.host);
        console.log('Pathname:', window.location.pathname);
        console.log('Search:', window.location.search);
        console.log('Hash:', window.location.hash);
        console.log('Location state:', location.state);
        console.log('Location search:', location.search);
        console.log('Location hash:', location.hash);
        
        // Parse all possible parameter sources
        let token = null;
        let error = null;
        let errorDescription = null;
        
        // Method 1: Parse hash parameters (most common for OAuth implicit flow)
        const hash = window.location.hash;
        if (hash) {
          console.log('Parsing hash:', hash);
          const hashWithoutSymbol = hash.startsWith('#') ? hash.substring(1) : hash;
          const hashParams = new URLSearchParams(hashWithoutSymbol);
          
          // Log all hash parameters
          console.log('Hash parameters:');
          for (const [key, value] of hashParams.entries()) {
            console.log(`  ${key}: ${key.toLowerCase().includes('token') ? value.substring(0, 10) + '...' : value}`);
          }
          
          token = hashParams.get('access_token') || hashParams.get('token') || hashParams.get('oauth_token');
          error = hashParams.get('error');
          errorDescription = hashParams.get('error_description');
        }
        
        // Method 2: Parse query parameters (fallback)
        const search = window.location.search;
        if (search && !token && !error) {
          console.log('Parsing search params:', search);
          const searchParams = new URLSearchParams(search);
          
          // Log all search parameters
          console.log('Search parameters:');
          for (const [key, value] of searchParams.entries()) {
            console.log(`  ${key}: ${key.toLowerCase().includes('token') ? value.substring(0, 10) + '...' : value}`);
          }
          
          token = searchParams.get('access_token') || searchParams.get('token') || searchParams.get('oauth_token');
          error = searchParams.get('error');
          errorDescription = searchParams.get('error_description');
        }
        
        // Method 3: Manual parsing for edge cases
        if (!token && !error) {
          console.log('Trying manual parsing...');
          
          // Parse hash manually
          if (hash) {
            const hashParts = hash.substring(1).split('&');
            for (const part of hashParts) {
              const [key, value] = part.split('=');
              if (key && value && (key === 'access_token' || key === 'token' || key === 'oauth_token')) {
                token = decodeURIComponent(value);
                console.log('Found token via manual hash parsing:', key);
                break;
              }
            }
          }
          
          // Parse search manually
          if (!token && search) {
            const searchParts = search.substring(1).split('&');
            for (const part of searchParts) {
              const [key, value] = part.split('=');
              if (key && value && (key === 'access_token' || key === 'token' || key === 'oauth_token')) {
                token = decodeURIComponent(value);
                console.log('Found token via manual search parsing:', key);
                break;
              }
            }
          }
        }
        
        // Method 4: Check for any parameter that looks like a token
        if (!token && !error) {
          console.log('Checking for any token-like parameters...');
          const allHashParams = new URLSearchParams(hash.substring(1));
          const allSearchParams = new URLSearchParams(search);
          
          // Check hash params
          for (const [key, value] of allHashParams.entries()) {
            if ((key.toLowerCase().includes('token') || key.toLowerCase().includes('access')) && value.length > 10) {
              token = value;
              console.log('Found token-like parameter in hash:', key);
              break;
            }
          }
          
          // Check search params
          if (!token) {
            for (const [key, value] of allSearchParams.entries()) {
              if ((key.toLowerCase().includes('token') || key.toLowerCase().includes('access')) && value.length > 10) {
                token = value;
                console.log('Found token-like parameter in search:', key);
                break;
              }
            }
          }
        }

        console.log('=== Final Results ===');
        console.log('Token found:', token ? 'YES (length: ' + token.length + ')' : 'NO');
        console.log('Error found:', error || 'NO');
        console.log('Error description:', errorDescription || 'NO');

        if (error) {
          console.error('OAuth error:', error, errorDescription);
          const errorMsg = errorDescription || error;
          navigate('/login?error=' + encodeURIComponent(errorMsg), { replace: true });
          return;
        }

        if (token) {
          console.log('Token received, attempting login... Token preview:', token.substring(0, 15) + '...');
          await loginWithOAuth(token); // This is OAuth login
          console.log('Login successful, redirecting...');
          
          // Redirect to the original URL or dashboard
          const redirectUrl = localStorage.getItem('oauth_redirect_url') || '/';
          localStorage.removeItem('oauth_redirect_url');
          navigate(redirectUrl, { replace: true });
        } else {
          console.error('No token received in OAuth callback');
          navigate('/login?error=' + encodeURIComponent('No authentication token received. Please check browser console for details.'), { replace: true });
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