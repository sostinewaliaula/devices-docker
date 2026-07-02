import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, MailIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useGoogleConfig } from '../../contexts/GoogleConfigContext';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import MfaVerification from '../../components/auth/MfaVerification';
import ThemeToggle from '../../components/ui/ThemeToggle';
import { useBranding } from '../../contexts/BrandingContext';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaData, setMfaData] = useState<{ userId: string; user: any } | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { logoUrl, siteName } = useBranding();
  const { enabled: googleEnabled } = useGoogleConfig();
  const {
    login, googleLogin
  } = useAuth();
  const {
  } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  // Get the return URL from location state or default to home
  const from = location.state?.from?.pathname || '/';
  // Helper to split site name for dual coloring
  const getSiteNameParts = () => {
    if (!siteName) return { first: 'Caava', rest: 'Group' };
    const parts = siteName.split(' ');
    const first = parts[0];
    const rest = parts.slice(1).join(' ');
    // If only one word, show it all in primary
    if (!rest) return { first: siteName, rest: '' };
    return { first, rest };
  };

  const { first: siteNameFirst, rest: siteNameRest } = getSiteNameParts();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);

      if (result.requiresMfa) {
        setMfaData({
          userId: result.userId!,
          user: result.user!
        });
        setMfaRequired(true);
      } else {
        addToast({
          title: 'Login Successful',
          message: `Welcome back!`,
          type: 'success',
          duration: 3000
        });
        navigate(from, {
          replace: true
        });
      }
    } catch (err) {
      setError('Failed to sign in. Please check your credentials.');
      addToast({
        title: 'Login Failed',
        message: 'Please check your email and password.',
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaSuccess = () => {
    addToast({
      title: 'Login Successful',
      message: `Welcome back!`,
      type: 'success',
      duration: 3000
    });
    navigate(from, {
      replace: true
    });
  };

  const handleMfaBack = () => {
    setMfaRequired(false);
    setMfaData(null);
  };

  const handleGoogleError = (msg = 'Google sign-in failed. Please try again.') => {
    setError(msg);
    addToast({ title: 'Sign-in Failed', message: msg, type: 'error', duration: 5000 });
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setIsLoading(true);
    try {
      const result = await googleLogin(credentialResponse.credential);
      if (!result.profile_complete) {
        navigate('/complete-profile', { replace: true });
        return;
      }
      addToast({ title: 'Login Successful', message: 'Welcome back!', type: 'success', duration: 3000 });
      navigate(from, { replace: true });
    } catch (err: any) {
      handleGoogleError(err.message || 'Google sign-in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show MFA verification if required
  if (mfaRequired && mfaData) {
    return (
      <MfaVerification
        userId={mfaData.userId}
        user={mfaData.user}
        onBack={handleMfaBack}
        onSuccess={handleMfaSuccess}
      />
    );
  }

  return <div className="flex items-center min-h-screen p-6 bg-lightred dark:bg-gray-950">
    <div className="flex-1 h-full max-w-4xl mx-auto overflow-hidden bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <div className="flex flex-col overflow-y-auto md:flex-row">
        <div className="h-32 md:h-auto md:w-1/2">
          <img aria-hidden="true" className="object-cover w-full h-full rounded-l-2xl" src="https://i.ibb.co/zWhdQPHQ/Themabeeld-ITSAM-1-2048x1363-1-1.png" alt="Office" />
        </div>
        <div className="flex items-center justify-center p-6 sm:p-12 md:w-1/2">
          <div className="w-full">
            <div className="flex justify-end mb-4">
              <ThemeToggle />
            </div>
            <div className="flex flex-col items-center mb-8">
              <img src={logoUrl} alt={siteName} className="h-12 w-auto mb-2 icon-primary" />
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-primary">{siteNameFirst}</h1>
                {siteNameRest && <h1 className="ml-2 text-2xl font-bold text-secondary">{siteNameRest}</h1>}
              </div>
            </div>
            <h1 className="mb-4 text-xl font-bold text-primary dark:text-primary">Login</h1>
            {error && <div className="px-4 py-2 mb-4 text-sm text-red-700 bg-red-100 dark:bg-red-900 dark:text-red-200 rounded-md">{error}</div>}
            <form onSubmit={handleSubmit}>
              <label className="block text-sm">
                <span className="text-primary dark:text-primary">Email</span>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MailIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <input className="block w-full pl-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40" placeholder="your@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </label>
              <label className="block mt-4 text-sm">
                <span className="text-primary dark:text-primary">Password</span>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <LockIcon className="w-5 h-5 text-gray-400" />
                  </div>
                  <input className="block w-full pl-10 pr-10 mt-1 text-sm border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl form-input focus:border-primary focus:outline-none focus:ring focus:ring-primary focus:ring-opacity-40" placeholder="************" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-300 hover:text-primary" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </label>
              <div className="flex mt-6 text-sm">
                <Link to="/forgot-password" className="text-sm text-secondary hover:underline">Forgot your password?</Link>
              </div>
              {/* Terms agreement */}
              <div className="mt-5">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={e => setAgreedToTerms(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                      {agreedToTerms && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 10">
                          <path d="M1 5l3.5 3.5L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    I have read and agree to the{' '}
                    <Link to="/terms" target="_blank" className="text-primary font-medium hover:underline">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" target="_blank" className="text-secondary font-medium hover:underline">Privacy Policy</Link>
                  </span>
                </label>
              </div>
              <button type="submit" className="button-primary block w-full px-4 py-2 mt-4 text-sm font-medium leading-5 text-center disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading || !agreedToTerms}>{isLoading ? 'Logging in...' : 'Log in'}</button>
            </form>
            {googleEnabled && agreedToTerms && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400">or continue with</span>
                  </div>
                </div>
                <div className="flex justify-center">
                  <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={() => handleGoogleError()} label="Sign in with Google" />
                </div>
              </>
            )}
            <hr className="my-8" />
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="text-secondary hover:underline font-medium"
                >
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
};
export default Login;
