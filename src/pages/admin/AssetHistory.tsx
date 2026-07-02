import React, { useCallback, useEffect, useState } from 'react';
import { HistoryIcon, SearchIcon, RefreshCwIcon, ChevronRightIcon, SlidersHorizontalIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { assetService, departmentService } from '../../services/apiDatabase';
import { AssetHistorySummary, Department } from '../../lib/supabase';

const PAGE_SIZE = 12;

const AssetHistory: React.FC = () => {
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<AssetHistorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<{ page: number; pages: number; total: number; limit: number }>({
    page: 1,
    pages: 1,
    total: 0,
    limit: PAGE_SIZE
  });

  const fetchAssets = useCallback(
    async (targetPage: number = 1) => {
      try {
        setLoading(true);
        const response = await assetService.getHistorySummary({
          search: search || undefined,
          status: statusFilter || undefined,
          type: typeFilter || undefined,
          department_id: departmentFilter || undefined,
          page: targetPage,
          limit: PAGE_SIZE
        });
        setAssets(response.assets || []);
        setPagination(response.pagination || { page: targetPage, pages: 1, total: 0, limit: PAGE_SIZE });
        setPage(response.pagination?.page || targetPage);
      } catch (error: any) {
        console.error('Failed to load asset summary:', error);
        addToast({
          title: 'Error loading assets',
          message: error?.response?.data?.message || 'Unable to load assets for history view.',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    },
    [addToast, search, statusFilter, typeFilter, departmentFilter]
  );

  useEffect(() => {
    fetchAssets(1);
  }, [fetchAssets, search]);

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const list = await departmentService.getAll();
        setDepartments(list || []);
      } catch (error) {
        console.error('Failed to load departments for asset filters:', error);
      }
    };
    loadDepartments();
  }, []);

  const handleSearchChange = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  const handleStatusChange = (value: string) => {
    setPage(1);
    setStatusFilter(value);
  };

  const handleTypeChange = (value: string) => {
    setPage(1);
    setTypeFilter(value);
  };

  const handleDepartmentChange = (value: string) => {
    setPage(1);
    setDepartmentFilter(value);
  };

  const clearFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setDepartmentFilter('');
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Asset History</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-300">
              Review key stats for each asset before opening the full assignment and issue timeline.
            </p>
          </div>
          <button
            onClick={() => fetchAssets(page)}
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
            placeholder="Search asset name, serial number, type, or location..."
            className="w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
          />
        </div>
        <div className="mt-4 inline-flex px-3 py-1 rounded-full bg-lightred text-primary font-medium">
          {pagination.total} assets
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <select
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="in_use">In use</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => handleTypeChange(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-200 focus:ring-primary focus:border-primary"
            >
              <option value="">All types</option>
              <option value="laptop">Laptop</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="accessory">Accessory</option>
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
            <HistoryIcon className="w-10 h-10 animate-spin mb-3 text-primary" />
            Loading assets...
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <HistoryIcon className="w-12 h-12 mb-3" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">No assets match your search</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Try a different keyword or reset your search.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {assets.map(asset => (
                <Link
                  key={asset.id}
                  to={`/admin/assets/history/${asset.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{asset.name}</div>
                    <div className="text-sm text-gray-500">
                      {asset.serial_number || 'Serial unknown'}
                    </div>
                    <div className="text-xs text-gray-400">
                      {asset.type || 'Type unknown'} • {asset.location || 'Location unknown'}
                    </div>
                  </div>
                  <div className="flex items-center text-primary text-sm font-semibold">
                    View history
                    <ChevronRightIcon className="w-4 h-4 ml-1" />
                  </div>
                </Link>
              ))}
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-gray-800 text-sm">
              <div className="text-gray-600 dark:text-gray-300">
                Page {pagination.page} of {pagination.pages} · {pagination.total} assets total
              </div>
              <div className="flex items-center gap-3 mt-3 md:mt-0">
                <button
                  onClick={() => fetchAssets(Math.max(1, page - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchAssets(Math.min(pagination.pages, page + 1))}
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

const Metric: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col">
    <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
    <span className="text-base font-semibold text-gray-900 dark:text-gray-100">{value}</span>
    {sub && <span className="text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
  </div>
);

export default AssetHistory;

