import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchIcon, RefreshCwIcon, UsersIcon, MonitorIcon, TicketIcon, ClipboardListIcon, ArrowRightIcon, HistoryIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { departmentService, userService } from '../../services/apiDatabase';
import { Department, UserHistorySummary } from '../../lib/supabase';

const PAGE_LIMIT = 12;

const UserHistory: React.FC = () => {
  const { addToast } = useNotifications();
  const [users, setUsers] = useState<UserHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; pages: number; total: number; limit: number }>({
    page: 1,
    pages: 1,
    total: 0,
    limit: PAGE_LIMIT
  });

  const fetchUsers = useCallback(
    async (targetPage: number = 1) => {
      try {
        setLoading(true);
        const response = await userService.getHistorySummary({
          search: search || undefined,
          role: roleFilter || undefined,
          department_id: departmentFilter || undefined,
          page: targetPage,
          limit: PAGE_LIMIT
        });
        setUsers(response.users || []);
        setPagination(response.pagination || { page: targetPage, pages: 1, total: 0, limit: PAGE_LIMIT });
        setPage(response.pagination?.page || targetPage);
      } catch (error: any) {
        console.error('Failed to load user history summary:', error);
        addToast({
          title: 'Error',
          message: error?.response?.data?.message || 'Unable to load user history summary.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast, search, roleFilter, departmentFilter]
  );

  useEffect(() => {
    fetchUsers(1);
}, [fetchUsers]);

useEffect(() => {
  const loadDepartments = async () => {
    try {
      const data = await departmentService.getAll();
      setDepartments(data || []);
    } catch (error) {
      console.error('Failed to load departments for filters:', error);
    }
  };
  loadDepartments();
}, []);

const handleSearchChange = (value: string) => {
  setPage(1);
  setSearch(value);
};

const handleRoleChange = (value: string) => {
  setPage(1);
  setRoleFilter(value);
};

const handleDepartmentChange = (value: string) => {
  setPage(1);
  setDepartmentFilter(value);
};

const clearFilters = () => {
  setRoleFilter('');
  setDepartmentFilter('');
  setPage(1);
};

  const visibleUsers = useMemo(() => users ?? [], [users]);

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">User History</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Track device assignments, issue activity, and asset requests per user.
            </p>
          </div>
          <button
            onClick={() => fetchUsers(page)}
            className="inline-flex items-center px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <RefreshCwIcon className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        <div className="mt-6 relative max-w-xl">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, position or department..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
          />
        </div>
        <div className="mt-4 inline-flex px-3 py-1 rounded-full bg-lightred text-primary font-medium">
          {pagination.total} users
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <select
              value={roleFilter}
              onChange={e => handleRoleChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            >
              <option value="">All roles</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="user">Users</option>
            </select>
            <select
              value={departmentFilter}
              onChange={e => handleDepartmentChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            >
              <option value="">All departments</option>
              {departments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <SlidersHorizontalIcon className="w-4 h-4 mr-2" />
            Reset filters
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden min-h-[320px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-600 dark:text-gray-300">
            <UsersIcon className="w-10 h-10 animate-spin mb-3 text-primary" />
            Loading user history...
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <UsersIcon className="w-12 h-12 mb-3" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">No matching users</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search keywords.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {visibleUsers.map(user => (
                <Link
                  key={user.id}
                  to={`/admin/users/history/${user.id}`}
                  className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{user.name}</h3>
                      <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {user.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-400">
                      {user.position || 'No position'} • {user.department_name || 'No department'}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm text-gray-600 dark:text-gray-300">
                    <Metric icon={<MonitorIcon className="w-4 h-4" />} label="Assignments" value={`${user.assignment_count} total`} sub={`${user.active_assignment_count} active`} />
                    <Metric icon={<TicketIcon className="w-4 h-4" />} label="Issues" value={`${user.issues_reported_count} raised`} sub={`${user.issues_assigned_count} assigned`} />
                    <Metric icon={<ClipboardListIcon className="w-4 h-4" />} label="Requests" value={`${user.asset_request_count}`} sub="asset requests" />
                    <Metric icon={<HistoryIcon className="w-4 h-4" />} label="Last activity" value={user.last_activity ? new Date(user.last_activity).toLocaleString() : '—'} sub="" />
                  </div>
                  <div className="flex items-center text-primary text-sm font-semibold">
                    View history
                    <ArrowRightIcon className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 text-sm">
              <div className="text-gray-600 dark:text-gray-300">
                Page {pagination.page} of {pagination.pages} · {pagination.total} users total
              </div>
              <div className="flex items-center gap-3 mt-3 md:mt-0">
                <button
                  onClick={() => fetchUsers(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchUsers(Math.min(pagination.pages, page + 1))}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const Metric: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string }> = ({ icon, label, value, sub }) => (
  <div className="flex flex-col">
    <div className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-gray-400">
      {icon}
      {label}
    </div>
    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    {sub && <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
  </div>
);

export default UserHistory;

