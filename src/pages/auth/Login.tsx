import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { LockIcon, MailIcon, EyeIcon, EyeOffIcon } from 'lucide-react';
import { useGoogleConfig } from '../../contexts/GoogleConfigContext';
import GoogleSignInButton from '../../components/auth/GoogleSignInButton';
import MfaVerification from '../../components/auth/MfaVerification';
import AuthLayout, { AuthAlert, AuthDivider, authStyles } from '../../components/auth/AuthLayout';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaData, setMfaData] = useState<{ userId: string; user: any } | null>(null);
  // Google is the default sign-in path; the email/password form is revealed on demand
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const { enabled: googleEnabled, loaded: googleLoaded } = useGoogleConfig();
  // Without Google there'd be no way in, so the password form is always shown then
  const passwordFormVisible = !googleEnabled || showPasswordLogin;
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

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your account"
      footer={
        <>
          Don't have an account?{' '}
          <Link to="/register" className={authStyles.link}>Sign up</Link>
        </>
      }
    >
      {error && <AuthAlert className="mb-4">{error}</AuthAlert>}
      {!googleLoaded ? (
        // Reserve space while we learn whether Google is enabled, so the form doesn't flash in and out
        <div className="h-40" aria-busy="true" />
      ) : (
        <>
          {googleEnabled && (
            <GoogleSignInButton onSuccess={handleGoogleSuccess} onError={() => handleGoogleError()} label="Sign in with Google" />
          )}
          {googleEnabled && !showPasswordLogin && (
            <button
              type="button"
              onClick={() => setShowPasswordLogin(true)}
              className={`block w-full mt-5 text-sm text-center ${authStyles.link}`}
            >
              Sign in with email and password instead
            </button>
          )}
          {googleEnabled && showPasswordLogin && <AuthDivider>or sign in with email</AuthDivider>}
          {passwordFormVisible && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className={authStyles.label}>Email</span>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <MailIcon className={authStyles.iconInInput} />
                  </div>
                  <input className={`${authStyles.input} pl-11 pr-4`} placeholder="your@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus={googleEnabled} required />
                </div>
              </label>
              <label className="block">
                <span className={authStyles.label}>Password</span>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <LockIcon className={authStyles.iconInInput} />
                  </div>
                  <input className={`${authStyles.input} pl-11 pr-11`} placeholder="************" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-3.5 text-muted hover:text-primary" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </label>
              <div className="flex text-sm">
                <Link to="/forgot-password" className={authStyles.link}>Forgot your password?</Link>
              </div>
              <button type="submit" className={authStyles.button} disabled={isLoading}>{isLoading ? 'Logging in...' : 'Log in'}</button>
            </form>
          )}
        </>
      )}
      <p className="mt-6 text-xs leading-relaxed text-center text-muted">
        By continuing, you agree to our{' '}
        <Link to="/terms" target="_blank" className={authStyles.link}>Terms of Service</Link>
        {' '}and{' '}
        <Link to="/privacy" target="_blank" className={authStyles.link}>Privacy Policy</Link>.
      </p>
    </AuthLayout>
  );
};
export default Login;
