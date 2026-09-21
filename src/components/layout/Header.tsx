import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useTheme } from '../../contexts/ThemeContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { MenuIcon, BellIcon } from 'lucide-react';
import NotificationDropdown from '../ui/NotificationDropdown';
import ThemeToggle from '../ui/ThemeToggle';
import UserAvatar from '../ui/UserAvatar';
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

  return <header className="z-10 py-4 bg-surface border-b border-line shadow-sm">
    <div className="container flex items-center justify-between h-full px-4 sm:px-6 mx-auto">
      {/* Mobile menu button */}
      <div className="flex items-center lg:hidden mr-2">
        <button onClick={toggleSidebar} aria-label="Open sidebar" className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary dark:focus:ring-accent bg-surface-2">
          <MenuIcon className="w-5 h-5 text-content" />
        </button>
      </div>
      {/* Logo */}
      <Link to="/" className="flex items-center mr-4 sm:mr-8 select-none">
        <span className="text-2xl font-bold text-primary dark:text-heading">Devices -</span>
        <span className="text-2xl font-bold ml-1 text-secondary dark:text-white">Management</span>
      </Link>

      <div className="flex-1"></div>

      <div className="flex items-center">

        {/* Theme toggler */}
        <div className="mr-5">
          <ThemeToggle />
        </div>
        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setNotificationsOpen(!notificationsOpen)} className="p-1 mr-5 rounded-md focus:outline-none focus:ring-2 focus:ring-secondary dark:focus:ring-accent relative" aria-label="Notifications">
            <BellIcon className="w-5 h-5 text-muted hover:text-heading" />
            {unreadCount > 0 && <span className="absolute top-0 right-0 inline-block w-3 h-3 transform translate-x-1 -translate-y-1 bg-primary border-2 border-surface rounded-full"></span>}
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
              <p className="text-sm font-medium text-heading">
                {user?.name}
              </p>
              <p className="text-xs font-medium text-muted">
                {user?.role === 'admin' ? 'Administrator' : 'User'}
              </p>
            </div>
            <UserAvatar userId={user?.id} name={user?.name} version={user?.avatar_updated_at} size="md" className="mr-2" />
          </button>
          {accountOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-surface rounded-2xl shadow-xl border border-line overflow-hidden z-20">
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-2">
                <UserAvatar userId={user?.id} name={user?.name} version={user?.avatar_updated_at} size="lg" />
                <div className="min-w-0">
                <p className="text-sm font-semibold text-heading">{user?.name || 'Account'}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
                <span className="inline-block mt-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-secondary/10 text-secondary dark:bg-accent/15 dark:text-accent">
                  {user?.role === 'admin' ? 'Administrator' : (user?.role || 'User')}
                </span>
                </div>
              </div>
              <div className="py-1">
                <Link
                  to="/profile"
                  className="block px-4 py-2.5 text-sm text-content hover:bg-surface-2"
                  onClick={() => setAccountOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="block px-4 py-2.5 text-sm text-content hover:bg-surface-2"
                  onClick={() => setAccountOpen(false)}
                >
                  Settings
                </Link>
              </div>
              <div className="h-px bg-line" />
              <button
                onClick={() => {
                  setAccountOpen(false);
                  logout();
                  setTimeout(() => { window.location.href = '/login'; }, 300);
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-primary dark:text-heading hover:bg-lightred"
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
