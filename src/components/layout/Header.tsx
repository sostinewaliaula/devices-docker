import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MenuIcon, BellIcon, UserIcon } from 'lucide-react';
import NotificationDropdown from '../ui/NotificationDropdown';
import ThemeToggle from '../ui/ThemeToggle';
interface HeaderProps {
  toggleSidebar: () => void;
}
const Header: React.FC<HeaderProps> = ({
  toggleSidebar
}) => {
  const { user, logout } = useAuth();
  const { } = useTheme();
  const { unreadCount } = useNotifications();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return <header className="z-10 py-4 bg-white dark:bg-gray-900 shadow-sm">
    <div className="container flex items-center justify-between h-full px-4 sm:px-6 mx-auto">
      {/* Mobile menu button */}
      <div className="flex items-center lg:hidden mr-2">
        <button onClick={toggleSidebar} aria-label="Open sidebar" className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary bg-gray-100 dark:bg-gray-800">
          <MenuIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
        </button>
      </div>
      {/* Logo */}
      <Link to="/" className="flex items-center mr-4 sm:mr-8 select-none">
        <span className="text-2xl font-bold" style={{ color: '#D90429' }}>Devices -</span>
        <span className="text-2xl font-bold ml-1" style={{ color: '#152F52' }}>Management</span>
      </Link>

      <div className="flex-1"></div>

      <div className="flex items-center">

        {/* Theme toggler */}
        <div className="mr-5">
          <ThemeToggle />
        </div>
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="p-1 mr-5 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary relative" aria-label="Notifications">
            <BellIcon className="w-5 h-5 text-gray-500 dark:text-gray-200" />
            {unreadCount > 0 && <span className="absolute top-0 right-0 inline-block w-3 h-3 transform translate-x-1 -translate-y-1 bg-red-600 border-2 border-white rounded-full dark:border-gray-900"></span>}
          </button>
          {notificationsOpen && <NotificationDropdown onClose={() => setNotificationsOpen(false)} />}
        </div>
        {/* Profile */}
        <div className="relative" ref={accountRef}>
          <button
            onClick={() => setAccountOpen(!accountOpen)}
            className="flex items-center focus:outline-none"
            aria-label="Account"
          >
            <div className="hidden mr-2 text-right md:block">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {user?.name}
              </p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </p>
            </div>
            <div className="p-1 mr-2 text-gray-400 bg-gray-100 rounded-full dark:bg-gray-800">
              <UserIcon className="w-6 h-6" />
            </div>
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{user?.name || 'Account'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-lightred text-primary">
                  {user?.role === 'admin' ? 'Administrator' : (user?.role || 'User')}
                </span>
              </div>
              <div className="py-1">
                <Link
                  to="/profile"
                  className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-lightred/60 dark:hover:bg-gray-700/80"
                  onClick={() => setAccountOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-lightred/60 dark:hover:bg-gray-700/80"
                  onClick={() => setAccountOpen(false)}
                >
                  Settings
                </Link>
              </div>
              <div className="h-px bg-gray-200 dark:bg-gray-700" />
              <button
                onClick={() => {
                  setAccountOpen(false);
                  logout();
                  setTimeout(() => { window.location.href = '/login'; }, 300);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  </header>;
};
export default Header;
