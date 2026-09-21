import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MailIcon } from 'lucide-react';
import AuthLayout, { AuthAlert, AuthBadge, authStyles } from '../../components/auth/AuthLayout';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    forgotPassword
  } = useAuth();
  const {
  } = useTheme();
  const { addToast } = useNotifications();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    // Basic email validation
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    try {
      await forgotPassword(email);
      setMessage('A 6-digit verification code has been sent to your email. Please check your inbox and enter the code to reset your password.');
      setEmailSent(true);
      addToast({
        title: 'Code Sent',
        message: 'A verification code has been sent to your email.',
        type: 'success',
        duration: 5000
      });

      // Navigate to code verification page
      setTimeout(() => {
        navigate('/verify-code', {
          state: {
            email,
            resend: false
          }
        });
      }, 2000);
    } catch (err: any) {
      let errorMessage = 'Failed to send password reset email.';

      // Handle specific Supabase errors
      if (err?.message) {
        if (err.message.includes('User not found')) {
          errorMessage = 'No account found with this email address.';
        } else if (err.message.includes('rate limit')) {
          errorMessage = 'Too many attempts. Please wait a few minutes before trying again.';
        } else if (err.message.includes('Email not confirmed')) {
          errorMessage = 'Please confirm your email address before requesting a password reset.';
        } else {
          errorMessage = err.message;
        }
      }

      setError(errorMessage);
      addToast({
        title: 'Email Failed',
        message: errorMessage,
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setEmail('');
    setError('');
    setMessage('');
    setEmailSent(false);
  };

  return (
    <AuthLayout
      title={emailSent ? 'Check your email' : 'Forgot your password?'}
      subtitle={
        emailSent
          ? undefined
          : "Enter your email address and we'll send you a verification code to reset your password."
      }
      footer={<Link className={authStyles.link} to="/login">Back to Login</Link>}
    >
      {error && <AuthAlert className="mb-4">{error}</AuthAlert>}
      {message && <AuthAlert tone="success" className="mb-4">{message}</AuthAlert>}

      {!emailSent ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className={authStyles.label}>Email</span>
            <div className="relative mt-1">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <MailIcon className={authStyles.iconInInput} />
              </div>
              <input
                className={`${authStyles.input} pl-11 pr-4`}
                placeholder="your@email.com"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </label>
          <button type="submit" className={authStyles.button} disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      ) : (
        <div className="text-center">
          <AuthBadge tone="success">
            <MailIcon className="w-7 h-7" />
          </AuthBadge>
          <p className="mb-6 text-sm text-content">
            We've sent a verification code to <strong className="text-heading">{email}</strong>
          </p>
          <button onClick={handleResetForm} className={authStyles.buttonOutline}>
            Send to Different Email
          </button>
        </div>
      )}
    </AuthLayout>
  );
};

export default ForgotPassword;
