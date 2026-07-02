import { useRef, useEffect, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';

interface Props {
  onSuccess: (credentialResponse: any) => void;
  onError: () => void;
  label?: string;
}

const GoogleSignInButton = ({ onSuccess, onError, label = 'Continue with Google' }: Props) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full" style={{ height: '42px' }}>
      {/* Google's real button stretched to fill the container — completely invisible visually */}
      <div
        ref={wrapperRef}
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: 0 }}
      >
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          useOneTap={false}
          shape="pill"
          theme={isDark ? 'filled_black' : 'outline'}
          size="large"
          width="400"
          text="continue_with"
        />
      </div>

      {/* Our styled button rendered on top — pointer-events-none so clicks pass through to Google button */}
      <div
        className={`absolute inset-0 flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium leading-5 rounded-full pointer-events-none select-none ${
          isDark
            ? 'bg-gray-800 text-white border border-gray-700'
            : 'button-primary'
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <path fill="white" d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z"/>
        </svg>
        <span>{label}</span>
      </div>
    </div>
  );
};

export default GoogleSignInButton;
