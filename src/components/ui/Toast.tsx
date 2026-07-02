import React, { useEffect, useState } from 'react';
import { XIcon, CheckCircleIcon, AlertCircleIcon, InfoIcon, AlertTriangleIcon } from 'lucide-react';

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onDismiss: (id: string) => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ id, title, message, type, onDismiss, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show toast with animation
    const showTimer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto-dismiss after duration
    const dismissTimer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onDismiss(id), 300); // Wait for fade out animation
    }, duration);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(dismissTimer);
    };
  }, [id, duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <InfoIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <InfoIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  return (
    <div
      className={`
        max-w-sm w-full
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className={`
        p-4 rounded-lg border shadow-lg bg-white dark:bg-gray-800
        ${getBgColor()}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {title}
            </h4>
            {message && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                {message}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 ml-3">
            <button
              onClick={() => {
                setIsVisible(false);
                setTimeout(() => onDismiss(id), 300);
              }}
              className="inline-flex text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
