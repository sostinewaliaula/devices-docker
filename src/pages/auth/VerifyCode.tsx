import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MailIcon, ArrowLeftIcon, CheckCircleIcon } from 'lucide-react';
import AuthLayout, { AuthAlert, AuthBadge, AuthSpinner, authStyles } from '../../components/auth/AuthLayout';

const VerifyCode: React.FC = () => {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15 * 60); // 15 minutes in seconds

  const { verifyResetCode } = useAuth();
  const { } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  // Get email from location state or redirect to forgot password
  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    } else {
      navigate('/forgot-password');
    }
  }, [location.state, navigate]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (code.length !== 6) {
      setError('Please enter a 6-digit code.');
      setIsLoading(false);
      return;
    }

    try {
      await verifyResetCode(email, code);
      setIsVerified(true);
      addToast({
        title: 'Code Verified',
        message: 'Your code has been verified successfully.',
        type: 'success',
        duration: 3000
      });

      // Navigate to change password page after a short delay
      setTimeout(() => {
        navigate('/change-password', {
          state: {
            email,
            code,
            verified: true
          }
        });
      }, 1500);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to verify code. Please try again.';
      setError(errorMessage);
      addToast({
        title: 'Verification Failed',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = () => {
    navigate('/forgot-password', {
      state: {
        email,
        resend: true
      }
    });
  };

  if (isVerified) {
    return (
      <AuthLayout
        title="Code Verified!"
        subtitle="Redirecting you to change your password..."
        icon={
          <AuthBadge tone="success">
            <CheckCircleIcon className="w-7 h-7" />
          </AuthBadge>
        }
      >
        <div className="flex justify-center">
          <AuthSpinner />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Enter Verification Code"
      subtitle={
        <>
          We've sent a 6-digit code to <br />
          <span className="font-medium text-heading">{email}</span>
        </>
      }
      icon={
        <AuthBadge>
          <MailIcon className="w-7 h-7" />
        </AuthBadge>
      }
      footer={
        <Link to="/forgot-password" className={`inline-flex items-center justify-center ${authStyles.link}`}>
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back to Forgot Password
        </Link>
      }
    >
      {/* Timer */}
      <div className="mb-6 text-center">
        <span
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-xl border ${
            timeLeft === 0
              ? 'bg-lightred border-primary/30 text-primary dark:text-heading'
              : 'bg-brand-orange/10 border-brand-orange/40 text-content'
          }`}
        >
          Code expires in: {formatTime(timeLeft)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={`${authStyles.label} mb-2`}>Verification Code</label>
          <input
            type="text"
            value={code}
            onChange={handleCodeChange}
            placeholder="000000"
            className={`${authStyles.input} px-4 text-2xl font-mono tracking-widest text-center`}
            maxLength={6}
            disabled={isLoading}
            autoComplete="one-time-code"
          />
        </div>

        {error && <AuthAlert>{error}</AuthAlert>}

        <button
          type="submit"
          disabled={isLoading || code.length !== 6 || timeLeft === 0}
          className={authStyles.button}
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 mr-2 border-2 rounded-full animate-spin border-on-action/40 border-t-on-action"></div>
              Verifying...
            </>
          ) : (
            'Verify Code'
          )}
        </button>
      </form>

      <div className="mt-6 space-y-1 text-center">
        <p className="text-sm text-muted">Didn't receive the code?</p>
        <button
          onClick={handleResendCode}
          disabled={isLoading}
          className={`text-sm disabled:opacity-50 ${authStyles.link}`}
        >
          Resend Code
        </button>
      </div>
    </AuthLayout>
  );
};

export default VerifyCode;
