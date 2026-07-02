import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { SearchIcon, FilterIcon, CheckCircleIcon, AlertCircleIcon, ClockIcon, UserIcon, DownloadIcon, EyeIcon, EditIcon, TrashIcon, XCircleIcon, DollarSignIcon, RefreshCwIcon, ImageIcon } from 'lucide-react';
import { issueService, assetService, userService, departmentService, assetRequestTypeService } from '../../services/apiDatabase';
import { Issue, Asset, User, Department } from '../../lib/supabase';
import AssetImage from '../../components/AssetImage';
import api from '../../services/apiService';

// Static data for dropdowns
const issueStatuses = ['Open', 'In Progress', 'Pending User Action', 'Pending Parts', 'Resolved', 'Closed'];
const issuePriorities = ['Low', 'Medium', 'High', 'Critical'];

const DEFAULT_CURRENCY = import.meta.env.VITE_DEFAULT_CURRENCY || 'KES';

const IssueManagement: React.FC = () => {
  const {
    addToast
  } = useNotifications();
  const navigate = useNavigate();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<Issue[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [sortBy] = useState('created_at');
  const [sortDirection] = useState('desc');
  const [issueExporting, setIssueExporting] = useState(false);
  const [issueExportFormat, setIssueExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null);
  const [deletingIssue, setDeletingIssue] = useState<Issue | null>(null);

  const [costSummary, setCostSummary] = useState<{ total_estimated_cost: number; currency: string }>({
    total_estimated_cost: 0,
    currency: DEFAULT_CURRENCY
  });

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: costSummary.currency || DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    } catch {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: DEFAULT_CURRENCY,
        minimumFractionDigits: 2
      });
    }
  }, [costSummary.currency]);

  const formatCurrency = useCallback((value?: number | null) => {
    if (value === null || value === undefined) {
      return 'Not set';
    }
    return currencyFormatter.format(value);
  }, [currencyFormatter]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [issuesResponse, assetsData, usersData, departmentsData, typesData] = await Promise.all([
        api.get('/issues', { params: { includeCostSummary: true } }),
        assetService.getAll(),
        userService.getAll(),
        departmentService.getAll(),
        assetRequestTypeService.getAll()
      ]);

      const issuesData = issuesResponse.data?.issues || [];
      const normalizedIssues = issuesData.map((issue: Issue) => ({
        ...issue,
        estimated_cost: issue.estimated_cost === null || issue.estimated_cost === undefined
          ? null
          : Number(issue.estimated_cost)
      }));

      setIssues(normalizedIssues);
      setAssets(assetsData);
      setUsers(usersData);
      setDepartments(departmentsData);
      setAssetRequestTypes(typesData || []);
      const summary = issuesResponse.data?.cost_summary;
      setCostSummary(summary ? {
        total_estimated_cost: Number(summary.total_estimated_cost ?? 0),
        currency: summary.currency || DEFAULT_CURRENCY
      } : {
        total_estimated_cost: 0,
        currency: DEFAULT_CURRENCY
      });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: 'Failed to load data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and sort issues
  useEffect(() => {
    let result = [...issues];

    // Apply search filter
    if (searchTerm) {
      result = result.filter(issue =>
        issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (issue.category && issue.category.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (filterStatus !== 'All') {
      result = result.filter(issue => issue.status === filterStatus.toLowerCase().replace(' ', '_'));
    }

    // Apply priority filter
    if (filterPriority !== 'All') {
      result = result.filter(issue => issue.priority === filterPriority);
    }

    // Apply department filter
    if (filterDepartment !== 'All') {
      result = result.filter(issue => issue.department_id === filterDepartment);
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue: any = a[sortBy as keyof Issue];
      let bValue: any = b[sortBy as keyof Issue];

      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }

      if (sortDirection === 'asc') {
        return (aValue || 0) > (bValue || 0) ? 1 : -1;
      } else {
        return (aValue || 0) < (bValue || 0) ? 1 : -1;
      }
    });

    setFilteredIssues(result);
  }, [issues, searchTerm, filterStatus, filterPriority, filterDepartment, sortBy, sortDirection]);


  const handleIssueClick = (issue: Issue) => {
    navigate(`/admin/issues/${issue.id}`);
  };

  const handleEditClick = (issue: Issue) => {
    setEditingIssue(issue);
    setShowEditModal(true);
  };

  const handleDeleteClick = (issue: Issue) => {
    setDeletingIssue(issue);
    setShowDeleteModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIssue) return;

    try {
      const updatedData = {
        title: editingIssue.title,
        description: editingIssue.description,
        priority: editingIssue.priority.toLowerCase(),
        status: editingIssue.status,
        category: editingIssue.category,
        assigned_to: editingIssue.assigned_to,
        department_id: editingIssue.department_id,
        estimated_resolution_date: editingIssue.estimated_resolution_date,
        estimated_cost: editingIssue.estimated_cost === null || editingIssue.estimated_cost === undefined
          ? null
          : Number(editingIssue.estimated_cost)
      };

      const updated = await issueService.update(editingIssue.id, updatedData);

      setIssues(prev => prev.map(issue =>
        issue.id === editingIssue.id ? updated : issue
      ));

      setShowEditModal(false);
      setEditingIssue(null);

      addToast({
        title: 'Issue Updated',
        message: `Issue "${updated.title}" has been updated successfully.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to update issue:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update issue.',
        type: 'error'
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingIssue) return;

    try {
      await issueService.delete(deletingIssue.id);

      setIssues(prev => prev.filter(issue => issue.id !== deletingIssue.id));

      setShowDeleteModal(false);
      setDeletingIssue(null);

      addToast({
        title: 'Issue Deleted',
        message: `Issue "${deletingIssue.title}" has been deleted successfully.`,
        type: 'success'
      });
    } catch (error) {
      console.error('Failed to delete issue:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete issue.',
        type: 'error'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'in_progress':
      case 'pending_user_action':
      case 'pending_parts':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'resolved':
      case 'closed':
        return 'bg-lightred text-primary';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-lightred text-primary';
      case 'Medium':
        return 'bg-lightblue text-secondary';
      case 'High':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getAssetName = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return asset ? asset.name : 'Unknown Asset';
  };

  const getAssetImage = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    return (asset as any)?.image_url || '/api/placeholder/32/32';
  };

  const getReporterName = (reporterId: string) => {
    const reporter = users.find(u => u.id === reporterId);
    return reporter ? reporter.name : 'Unknown User';
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return 'Unassigned';
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Unknown';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleExport = async () => {
    try {
      setIssueExporting(true);
      // Export logic here
      addToast({ title: 'Export Started', message: 'Issue data export has been initiated', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Export Failed', message: 'Failed to export issue data', type: 'error' });
    } finally {
      setIssueExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading issues...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Issue Management</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">Manage and track all system issues.</p>
          </div>
          <div className="flex items-center space-x-4">
            <select
              value={issueExportFormat}
              onChange={(e) => setIssueExportFormat(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="txt">TXT</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              onClick={handleExport}
              disabled={issueExporting}
              className="flex items-center px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              <DownloadIcon className="w-4 h-4 mr-2" />
              {issueExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <AlertCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Open Issues</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(issue => issue.status === 'open').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">In Progress</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(issue => issue.status === 'in_progress').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightblue rounded-full">
              <ClockIcon className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(issue => issue.status === 'pending_user_action' || issue.status === 'pending_parts').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightred rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Resolved</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(issue => issue.status === 'resolved' || issue.status === 'closed').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-3 mr-4 bg-blue-100 rounded-full">
                <DollarSignIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Total Estimated Cost</p>
                <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                  {formatCurrency(costSummary.total_estimated_cost)}
                </p>
              </div>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">{costSummary.currency}</span>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <SearchIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Search issues..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                {issueStatuses.map(status => (
                  <option key={status} value={status}>
                    {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
              >
                {issuePriorities.map(priority => (
                  <option key={priority} value={priority}>
                    {priority === 'All' ? 'All Priorities' : priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400" />
              </div>
              <select
                className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={filterDepartment}
                onChange={e => setFilterDepartment(e.target.value)}
              >
                <option value="All">All Departments</option>
                {departments.map(dept => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('All');
                setFilterPriority('All');
                setFilterDepartment('All');
              }}
              className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 flex items-center"
            >
              <RefreshCwIcon className="w-4 h-4 mr-2" /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">All Issues</h2>
            <span className="px-3 py-1 text-sm font-medium text-primary bg-lightred rounded-full">{filteredIssues.length} issues</span>
          </div>
        </div>

        {filteredIssues.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Issue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Est. Cost
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Reporter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => handleIssueClick(issue)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <AlertCircleIcon className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {issue.title}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {issue.description.length > 50
                              ? `${issue.description.substring(0, 50)}...`
                              : issue.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(issue.status)}`}>
                        {issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(issue.priority)}`}>
                        {issue.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {issue.estimated_cost !== null && issue.estimated_cost !== undefined
                        ? formatCurrency(issue.estimated_cost)
                        : 'Not set'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getDepartmentName(issue.department_id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {issue.asset_id ? (
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center mr-3 border border-gray-200 dark:border-gray-800">
                            <AssetImage
                              asset={assets.find(a => a.id === issue.asset_id)}
                              assetType={assetRequestTypes.find(t => t.name === (assets.find(a => a.id === issue.asset_id) as any)?.type)}
                            />
                          </div>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {getAssetName(issue.asset_id)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">No Asset</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3">
                          <UserIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span className="text-sm text-gray-900 dark:text-white">
                          {getReporterName(issue.reported_by)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(issue.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleIssueClick(issue);
                          }}
                          className="text-primary hover:text-primary-dark flex items-center space-x-1"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(issue);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center space-x-1"
                          title="Edit Issue"
                        >
                          <EditIcon className="h-4 w-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(issue);
                          }}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center space-x-1"
                          title="Delete Issue"
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12">
            {searchTerm || filterStatus !== 'All' || filterPriority !== 'All' ? (
              <>
                <AlertCircleIcon className="w-16 h-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No issues found</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('All');
                    setFilterPriority('All');
                  }}
                  className="mt-4 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark"
                >
                  Reset Filters
                </button>
              </>
            ) : (
              <>
                <AlertCircleIcon className="w-16 h-16 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No issues yet</h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Issues will appear here once they are reported.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Edit Issue Modal */}
      {showEditModal && editingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-lightred dark:bg-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <EditIcon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-primary dark:text-white">Edit Issue</h3>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingIssue(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="overflow-y-auto max-h-[70vh] p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.title}
                    onChange={(e) => setEditingIssue({ ...editingIssue, title: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Priority
                  </label>
                  <select
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.priority}
                    onChange={(e) => setEditingIssue({ ...editingIssue, priority: e.target.value })}
                  >
                    {issuePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.status}
                    onChange={(e) => setEditingIssue({ ...editingIssue, status: e.target.value })}
                  >
                    {issueStatuses.map((status) => (
                      <option key={status} value={status.toLowerCase().replace(' ', '_')}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Cost
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 dark:text-gray-400">{costSummary.currency}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      value={editingIssue.estimated_cost ?? ''}
                      onChange={(e) => setEditingIssue({
                        ...editingIssue,
                        estimated_cost: e.target.value === '' ? null : Number(e.target.value)
                      })}
                      placeholder="Enter estimated cost"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <input
                    type="text"
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.category || ''}
                    onChange={(e) => setEditingIssue({ ...editingIssue, category: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Assigned To
                  </label>
                  <select
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.assigned_to || ''}
                    onChange={(e) => setEditingIssue({ ...editingIssue, assigned_to: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {users.filter(u => u.role === 'admin' || u.role === 'manager').map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Estimated Resolution Date
                  </label>
                  <input
                    type="date"
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.estimated_resolution_date ? new Date(editingIssue.estimated_resolution_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => setEditingIssue({ ...editingIssue, estimated_resolution_date: e.target.value || null })}
                  />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Department
                  </label>
                  <select
                    className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                    value={editingIssue.department_id || ''}
                    onChange={(e) => setEditingIssue({ ...editingIssue, department_id: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description *
                </label>
                <textarea
                  className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all resize-none"
                  rows={6}
                  value={editingIssue.description}
                  onChange={(e) => setEditingIssue({ ...editingIssue, description: e.target.value })}
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingIssue(null);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-sm font-medium text-white bg-primary rounded-xl hover:bg-primary-dark transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                  <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-xl font-bold text-red-600 dark:text-red-400">Delete Issue</h3>
              </div>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingIssue(null);
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to delete this issue? This action cannot be undone.
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {deletingIssue.title}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {deletingIssue.description.length > 100
                    ? `${deletingIssue.description.substring(0, 100)}...`
                    : deletingIssue.description}
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingIssue(null);
                }}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-6 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Delete Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IssueManagement;
