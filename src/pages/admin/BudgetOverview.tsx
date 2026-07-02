import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { budgetAPI, BudgetSummary } from '../../services/apiService';
import { useNotifications } from '../../contexts/NotificationContext';
import { RefreshCwIcon, AlertCircleIcon, DollarSignIcon, PieChartIcon, LayersIcon, FileDownIcon, FilterIcon } from 'lucide-react';

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'KES';

const statusColors: Record<string, string> = {
  open: 'text-red-600',
  in_progress: 'text-yellow-600',
  resolved: 'text-green-600',
  closed: 'text-slate-600',
  scheduled: 'text-purple-600',
  pending: 'text-yellow-600',
  approved: 'text-green-600',
  rejected: 'text-red-600',
  fulfilled: 'text-blue-600'
};

const BudgetOverview: React.FC = () => {
  const { addToast } = useNotifications();
  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  // Export filters
  const [isGeneralExport, setIsGeneralExport] = useState(false);
  const [selectedIssueStatuses, setSelectedIssueStatuses] = useState<string[]>(['open', 'in_progress', 'resolved', 'closed', 'scheduled']);
  const [selectedAssetStatuses, setSelectedAssetStatuses] = useState<string[]>(['pending', 'approved', 'rejected', 'fulfilled']);
  const [showExportOptions, setShowExportOptions] = useState(false);

  const issueStatusOptions = ['open', 'in_progress', 'resolved', 'closed', 'scheduled'];
  const assetStatusOptions = ['pending', 'approved', 'rejected', 'fulfilled'];

  const currencyFormatter = useMemo(() => {
    const currency = summary?.currency || DEFAULT_CURRENCY;
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2
      });
    } catch {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    }
  }, [summary?.currency]);

  const formatCurrency = useCallback((value?: number | null) => {
    if (value === null || value === undefined) return currencyFormatter.format(0);
    return currencyFormatter.format(value);
  }, [currencyFormatter]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const data = await budgetAPI.getSummary();
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch budget summary:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load budget summary',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'word' | 'excel') => {
    try {
      setExportingFormat(format);
      const blob = await budgetAPI.export(format, {
        issueStatuses: isGeneralExport ? undefined : selectedIssueStatuses,
        assetStatuses: isGeneralExport ? undefined : selectedAssetStatuses,
        isGeneral: isGeneralExport
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budget-summary-${isGeneralExport ? 'general' : 'custom'}.${format === 'word' ? 'docx' : format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export budget summary:', error);
      addToast({
        title: 'Export failed',
        message: `Could not generate ${format.toUpperCase()} export`,
        type: 'error'
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const toggleIssueStatus = (status: string) => {
    setSelectedIssueStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const toggleAssetStatus = (status: string) => {
    setSelectedAssetStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <RefreshCwIcon className="w-10 h-10 animate-spin text-primary" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Calculating budgets...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircleIcon className="w-12 h-12 text-red-500 mb-3" />
        <p className="text-gray-700 dark:text-gray-300">Budget summary is unavailable.</p>
        <button
          onClick={fetchSummary}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const issueStatusEntries = Object.entries(summary.issues.by_status || {});
  const requestStatusEntries = Object.entries(summary.asset_requests.by_status || {});

  const renderStatusList = (entries: [string, number][]) => (
    <div className="space-y-2 mt-4">
      {entries.length === 0 && <p className="text-sm text-gray-500">No cost data available.</p>}
      {entries.map(([status, value]) => (
        <div key={status} className="flex items-center justify-between text-sm">
          <span className={`font-medium capitalize ${statusColors[status] || 'text-gray-600'}`}>
            {status.replace(/_/g, ' ')}
          </span>
          <span className="text-gray-900 dark:text-gray-100">{formatCurrency(value)}</span>
        </div>
      ))}
    </div>
  );

  const renderRecentList = (items: BudgetSummary['issues']['recent'], label: string) => (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <LayersIcon className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{label}</h3>
        </div>
        <button
          onClick={fetchSummary}
          className="text-sm text-primary hover:underline flex items-center"
        >
          <RefreshCwIcon className="w-4 h-4 mr-1" /> Refresh
        </button>
      </div>
      <div className="space-y-4">
        {items.length === 0 && (
          <p className="text-gray-500 text-sm">No recent records.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700 pb-2">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{item.name || 'Untitled'}</p>
              <p className="text-xs text-gray-500">{new Date(item.updated_at).toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(item.estimated_cost)}</p>
              <p className={`text-xs uppercase ${statusColors[item.status] || 'text-gray-500'}`}>{item.status}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Budget Overview</h1>
          <p className="text-gray-600 dark:text-gray-300">Track projected spend for issues and asset requests in one place.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowExportOptions(!showExportOptions)}
            className={`flex items-center px-4 py-2 border rounded-xl text-sm font-medium transition-colors ${showExportOptions ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-lightred'}`}
          >
            <FilterIcon className="w-4 h-4 mr-2" />
            {showExportOptions ? 'Hide Export Options' : 'Export Options'}
          </button>
          {(['pdf', 'word', 'excel'] as const).map(format => (
            <button
              key={format}
              onClick={() => handleExport(format)}
              disabled={!!exportingFormat}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-lightred disabled:opacity-50 transition-colors"
            >
              <FileDownIcon className="w-4 h-4 mr-2" />
              {exportingFormat === format ? 'Exporting...' : `Export ${format.toUpperCase()}`}
            </button>
          ))}
        </div>
      </div>

      {showExportOptions && (
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card border border-primary/20 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-primary flex items-center">
              <FileDownIcon className="w-6 h-6 mr-2" />
              Export Configurations
            </h2>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">General Export</label>
              <button
                onClick={() => setIsGeneralExport(!isGeneralExport)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isGeneralExport ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isGeneralExport ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {!isGeneralExport ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Include Issue Statuses</h3>
                <div className="grid grid-cols-2 gap-3">
                  {issueStatusOptions.map(status => (
                    <label key={status} className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-lightred transition-colors border border-transparent hover:border-primary/20">
                      <input
                        type="checkbox"
                        checked={selectedIssueStatuses.includes(status)}
                        onChange={() => toggleIssueStatus(status)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {status.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-4">Include Asset Request Statuses</h3>
                <div className="grid grid-cols-2 gap-3">
                  {assetStatusOptions.map(status => (
                    <label key={status} className="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-lightred transition-colors border border-transparent hover:border-primary/20">
                      <input
                        type="checkbox"
                        checked={selectedAssetStatuses.includes(status)}
                        onChange={() => toggleAssetStatus(status)}
                        className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {status.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                <strong>General Export Mode:</strong> Automatically excludes "Resolved" and "Closed" issues, and "Rejected", "Approved", and "Fulfilled" asset requests. This provides a focused report on active, pending budgetary needs.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Issue Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.issues.total_cost)}
              </p>
            </div>
            <DollarSignIcon className="w-10 h-10 text-primary" />
          </div>
          <p className="text-sm text-gray-500 mt-2">{summary.issues.total_count} issues with estimates</p>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Asset Request Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.asset_requests.total_cost)}
              </p>
            </div>
            <PieChartIcon className="w-10 h-10 text-secondary" />
          </div>
          <p className="text-sm text-gray-500 mt-2">{summary.asset_requests.total_count} requests with estimates</p>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Combined Budget</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.combined.overall_total)}
              </p>
            </div>
            <DollarSignIcon className="w-10 h-10 text-emerald-500" />
          </div>
          <p className="text-sm text-gray-500 mt-2">Issues: {formatCurrency(summary.combined.total_issue_cost)}</p>
          <p className="text-sm text-gray-500">Requests: {formatCurrency(summary.combined.total_asset_request_cost)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Issue Cost Breakdown</h2>
            <span className="text-sm text-gray-500">{summary.issues.total_count} tracked issues</span>
          </div>
          {renderStatusList(issueStatusEntries)}
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Asset Request Breakdown</h2>
            <span className="text-sm text-gray-500">{summary.asset_requests.total_count} tracked requests</span>
          </div>
          {renderStatusList(requestStatusEntries)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderRecentList(summary.issues.recent, 'Recent Issue Estimates')}
        {renderRecentList(summary.asset_requests.recent, 'Recent Asset Request Estimates')}
      </div>
    </div>
  );
};

export default BudgetOverview;

