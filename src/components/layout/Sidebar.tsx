import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { useBranding } from '../../contexts/BrandingContext';
import {
  HomeIcon,
  MonitorIcon,
  TicketIcon,
  ClipboardListIcon,
  BellIcon,
  UserIcon,
  UsersIcon,
  BuildingIcon,
  SettingsIcon,
  LogOutIcon,
  DatabaseIcon,
  KeyIcon,
  DollarSignIcon,
  BriefcaseIcon,
  HistoryIcon,
  PackageIcon,
  TagIcon,
  ChevronDown
} from 'lucide-react';

type NavItem = {
  name: string;
  path: string;
  icon: React.ReactNode;
};

type NavSection = {
  id: string;
  title: string;
  items: NavItem[];
};

const baseUserNavItems: NavItem[] = [
  { name: 'Dashboard', path: '/user/dashboard', icon: <HomeIcon size={20} /> },
  { name: 'My Devices', path: '/user/assets', icon: <MonitorIcon size={20} /> },
  { name: 'My Issues', path: '/user/issues', icon: <TicketIcon size={20} /> },
  { name: 'My Requests', path: '/user/asset-requests', icon: <ClipboardListIcon size={20} /> },
  { name: 'Notifications', path: '/notifications', icon: <BellIcon size={20} /> },
  { name: 'Profile', path: '/profile', icon: <UserIcon size={20} /> }
];

const userSettingsNavItem: NavItem = { name: 'Settings', path: '/settings', icon: <SettingsIcon size={20} /> };

const adminCoreNavItems: NavItem[] = [
  { name: 'Admin Dashboard', path: '/admin/dashboard', icon: <HomeIcon size={20} /> },
  { name: 'Manage Assets', path: '/admin/assets', icon: <MonitorIcon size={20} /> },
  { name: 'Manage Issues', path: '/admin/issues', icon: <TicketIcon size={20} /> },
  { name: 'Manage Users', path: '/admin/users', icon: <UsersIcon size={20} /> },
  { name: 'Manage Departments', path: '/admin/departments', icon: <BuildingIcon size={20} /> },
  { name: 'Asset Requests', path: '/admin/asset-requests', icon: <TicketIcon size={20} /> }
];

const adminConfigNavItems: NavItem[] = [
  { name: 'Positions', path: '/admin/positions', icon: <BriefcaseIcon size={20} /> },
  { name: 'Asset Management Types', path: '/admin/asset-types', icon: <MonitorIcon size={20} /> },
  { name: 'Asset Request Types', path: '/admin/asset-requests/types', icon: <PackageIcon size={20} /> },
  { name: 'Issue Categories', path: '/admin/issue-categories', icon: <TagIcon size={20} /> }
];

const adminHistoryNavItems: NavItem[] = [
  { name: 'Asset History', path: '/admin/assets/history', icon: <HistoryIcon size={20} /> },
  { name: 'User History', path: '/admin/users/history', icon: <UsersIcon size={20} /> },
  { name: 'Budget Overview', path: '/admin/budget', icon: <DollarSignIcon size={20} /> }
];

const adminSecurityNavItems: NavItem[] = [
  { name: 'Backup Management', path: '/admin/backup', icon: <DatabaseIcon size={20} /> },
  { name: 'Audit Logs', path: '/admin/audit', icon: <DatabaseIcon size={20} /> },
  { name: 'MFA Management', path: '/admin/mfa-management', icon: <KeyIcon size={20} /> },
  { name: 'MFA Policies', path: '/admin/mfa-policies', icon: <SettingsIcon size={20} /> },
  { name: 'Weekly Notifications', path: '/admin/weekly-notifications', icon: <BellIcon size={20} /> }
];

const managerNavItems: NavItem[] = [
  { name: 'Manager Dashboard', path: '/manager/dashboard', icon: <HomeIcon size={20} /> },
  { name: 'Team Members', path: '/manager/team', icon: <UsersIcon size={20} /> },
  { name: 'Department Issues', path: '/manager/issues', icon: <TicketIcon size={20} /> },
  { name: 'Department Assets', path: '/manager/assets', icon: <MonitorIcon size={20} /> },
  { name: 'Asset Requests', path: '/manager/asset-requests', icon: <ClipboardListIcon size={20} /> },
  { name: 'Communication', path: '/manager/communication', icon: <BellIcon size={20} /> }
];
interface SidebarProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}
const Sidebar: React.FC<SidebarProps> = ({ toggleSidebar }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { addToast } = useNotifications();
  const { siteName, logoUrl } = useBranding();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager' || user?.role === 'admin';
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    admin_core: true,
    admin_config: true,
    admin_history: true,
    admin_security: true,
    manager_core: true,
    personal: true,
    user_nav: true
  });

  const personalNavItems = useMemo(() => [...baseUserNavItems, userSettingsNavItem], []);

  const navSections: NavSection[] = useMemo(() => {
    if (isAdmin) {
      return [
        { id: 'admin-core', title: 'Administration', items: adminCoreNavItems },
        { id: 'admin-config', title: 'Configuration', items: adminConfigNavItems },
        { id: 'admin-history', title: 'History & Reports', items: adminHistoryNavItems },
        { id: 'admin-security', title: 'Security & Maintenance', items: adminSecurityNavItems },
        { id: 'personal', title: 'My Workspace', items: personalNavItems }
      ];
    }

    if (isManager) {
      return [
        { id: 'manager-core', title: 'Department', items: managerNavItems },
        { id: 'personal', title: 'My Workspace', items: personalNavItems }
      ];
    }

    return [{ id: 'user-nav', title: 'Navigation', items: personalNavItems }];
  }, [isAdmin, isManager, personalNavItems]);

  useEffect(() => {
    setOpenSections(prev => {
      const next = { ...prev };
      let changed = false;
      navSections.forEach(section => {
        if (next[section.id] === undefined) {
          next[section.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [navSections]);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) =>
    `flex items-center px-3 sm:px-4 py-3 text-sm font-medium rounded-xl transition-colors duration-150 ${isActive(path)
      ? 'bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-button'
      : 'text-gray-700 dark:text-gray-200 hover:bg-lightred hover:text-primary dark:hover:text-primary'
    }`;

  const renderSection = (section: NavSection) => {
    if (!section.items.length) return null;
    const isSectionOpen = openSections[section.id] ?? true;
    return (
      <div key={section.id} className="mb-2">
        <button
          onClick={() => toggleSection(section.id)}
          className="w-full flex items-center justify-between px-2 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400"
        >
          <span>{section.title}</span>
          <ChevronDown
            size={16}
            className={`transition-transform ${isSectionOpen ? 'rotate-180 text-primary' : ''}`}
          />
        </button>
        <div className={isSectionOpen ? 'mt-1 space-y-1' : 'hidden'}>
          {section.items.map(item => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => { if (toggleSidebar) toggleSidebar(); }}
              className={linkClass(item.path)}
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </div>
      </div>
    );
  };
  return <div className="flex flex-col h-full py-2 text-gray-800 dark:text-gray-200">
    <div className="px-4 pb-2">
      <Link to="/" className="flex flex-col items-start" onClick={toggleSidebar}> {/* Changed closeSidebar to toggleSidebar */}
        <div className="flex flex-col items-start justify-center h-auto">
          {logoUrl && <img src={logoUrl} alt="Logo" className="h-12 w-full object-contain object-left mb-1" />}
          <div className="flex flex-col justify-center">
            <div className="flex items-center justify-start">
              <span className="text-xl font-bold text-primary truncate" title={siteName.split(' ')[0]}>{siteName.split(' ')[0]}</span>
              {siteName.split(' ').slice(1).join(' ') && (
                <span className="ml-1 text-xl font-bold text-secondary truncate" title={siteName.split(' ').slice(1).join(' ')}>
                  {siteName.split(' ').slice(1).join(' ')}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
    <div className="flex-1 px-2 space-y-3 overflow-y-auto">
      {navSections.map(renderSection)}
    </div>
    <div className="px-2 mt-6">
      <button onClick={() => {
        logout();
        if (toggleSidebar) toggleSidebar();
        addToast({
          title: 'Logged Out',
          message: 'You have been successfully logged out.',
          type: 'info',
          duration: 3000
        });
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
      }} className="mt-auto flex items-center px-4 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors w-full">
        <LogOutIcon size={20} className="mr-3" />
        Logout
      </button>
    </div>
  </div>;
};
export default Sidebar;
