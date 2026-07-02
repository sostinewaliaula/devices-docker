import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { SearchIcon, FilterIcon, AlertCircleIcon, CheckCircleIcon, ClockIcon, XCircleIcon, InfoIcon, CalendarIcon, TagIcon, EditIcon, TrashIcon, SaveIcon, ImageIcon } from 'lucide-react';
import { assetService, issueService, auditService, assetRequestTypeService } from '../../services/apiDatabase';
import AssetImage from '../../components/AssetImage';
import useIssueCategories from '../../hooks/useIssueCategories';

const UserIssues: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [filteredIssues, setFilteredIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [reportIssue, setReportIssue] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    category: '',
    asset_id: ''
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);

  // Edit functionality
  const [editingIssue, setEditingIssue] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    category: ''
  });
  const [saving, setSaving] = useState(false);

  // Delete functionality
  const [deletingIssue, setDeletingIssue] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const { issueCategories, activeIssueCategories, loadingIssueCategories } = useIssueCategories();

  useEffect(() => {
    if (!reportIssue.category && activeIssueCategories.length > 0) {
      setReportIssue(prev => ({ ...prev, category: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, reportIssue.category]);

  useEffect(() => {
    // Fetch user's issues and assets from API
    const fetchData = async () => {
      try {
        setLoading(true);
        if (!user?.id) {
          setAssets([]);
          setIssues([]);
          setFilteredIssues([]);
          setLoading(false);
          return;
        }

        // Fetch assets assigned to the user
        const assignedAssets = await assetService.getByAssignedUser(user.id);
        setAssets(assignedAssets);

        // Fetch issues reported by the user
        const reportedIssues = await issueService.getByReporter(user.id);

        // Fetch asset types for image fallback
        const typesData = await assetRequestTypeService.getAll();
        setAssetRequestTypes(typesData || []);

        // Enrich with asset names using API service
        const assetIds = Array.from(new Set((reportedIssues || []).map((i: any) => i.asset_id).filter(Boolean)));
        let idToAssetName = new Map<string, string>();
        if (assetIds.length > 0) {
          try {
            const allAssets = await assetService.getAll();
            allAssets.forEach((a: any) => {
              if (assetIds.includes(a.id)) {
                idToAssetName.set(a.id, a.name);
              }
            });
          } catch { }
        }

        const enriched = (reportedIssues || []).map((i: any) => ({
          ...i,
          assetName: i.asset_id ? (idToAssetName.get(i.asset_id) || i.asset_id) : 'No Asset',
          assetId: i.asset_id
        }));

        setIssues(enriched);
        setFilteredIssues(enriched);

        // Debug: Log stats calculations
        // console.log('Total issues:', enriched.length);
        // console.log('Open issues:', enriched.filter(issue => issue.status === 'open').length);
        // console.log('In Progress issues:', enriched.filter(issue => issue.status === 'in_progress').length);
        // console.log('Pending issues:', enriched.filter(issue => issue.status === 'pending_user_action' || issue.status === 'pending_parts').length);
        // console.log('Resolved issues:', enriched.filter(issue => issue.status === 'resolved' || issue.status === 'closed').length);
      } catch (error) {
        console.error('Error fetching data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load issues data',
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchData();
  }, [addToast, user?.id]);
  useEffect(() => {
    // Filter issues based on search term and filters
    let result = issues;
    if (searchTerm) {
      result = result.filter(issue => issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || issue.description.toLowerCase().includes(searchTerm.toLowerCase()) || (issue.assetName || '').toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (filterStatus !== 'All') {
      result = result.filter(issue => issue.status === filterStatus.toLowerCase());
    }
    if (filterPriority !== 'All') {
      result = result.filter(issue => issue.priority === filterPriority);
    }
    setFilteredIssues(result);
  }, [issues, searchTerm, filterStatus, filterPriority]);
  // Extract unique issue statuses from issues
  const issueStatuses = ['All', ...new Set(issues.map(issue => issue.status))];
  // Extract unique priorities from issues
  const issuePriorities = ['All', 'Low', 'Medium', 'High', 'Critical'];
  const canManageIssue = (issue: any) => issue.assigned_to === user?.id;

  // Check if user can edit/delete this issue
  const canEditIssue = (issue: any) => {
    if (!user || !issue) return false;
    return user.role === 'admin' || user.role === 'manager' || issue.reported_by === user.id;
  };

  // Edit functionality
  const handleEditIssue = (issue: any) => {
    setEditForm({
      title: issue.title || '',
      description: issue.description || '',
      status: issue.status || 'open',
      priority: issue.priority || 'medium',
      category: issue.category || ''
    });
    setEditingIssue(issue.id);
  };

  const handleSaveEdit = async () => {
    if (!editingIssue) return;

    try {
      setSaving(true);

      const updatedIssue = await issueService.update(editingIssue, editForm);

      // Update local state
      setIssues(issues.map(issue =>
        issue.id === editingIssue ? { ...issue, ...updatedIssue } : issue
      ));
      setEditingIssue(null);

      addToast({ title: 'Success', message: 'Issue updated successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error updating issue:', error);
      addToast({ title: 'Error', message: 'Failed to update issue', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingIssue(null);
    setEditForm({
      title: '',
      description: '',
      status: '',
      priority: '',
      category: ''
    });
  };

  // Delete functionality
  const handleDeleteIssue = async (issueId: string) => {
    try {
      setDeletingIssue(issueId);

      await issueService.delete(issueId);

      // Remove from local state
      setIssues(issues.filter(issue => issue.id !== issueId));
      setShowDeleteConfirm(null);

      addToast({ title: 'Success', message: 'Issue deleted successfully', type: 'success' });
    } catch (error: any) {
      console.error('Error deleting issue:', error);
      addToast({ title: 'Error', message: 'Failed to delete issue', type: 'error' });
    } finally {
      setDeletingIssue(null);
    }
  };

  const confirmDelete = (issueId: string) => {
    setShowDeleteConfirm(issueId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };
  const handleReportIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!reportIssue.title.trim() || !reportIssue.description.trim()) return;

    if (reportIssue.title.trim().length < 5) {
      addToast({
        title: 'Error',
        message: 'Issue title must be at least 5 characters long.',
        type: 'error'
      });
      return;
    }

    if (reportIssue.description.trim().length < 10) {
      addToast({
        title: 'Error',
        message: 'Issue description must be at least 10 characters long.',
        type: 'error'
      });
      return;
    }

    if (!reportIssue.category) {
      addToast({
        title: 'Error',
        message: 'Please select an issue category.',
        type: 'error'
      });
      return;
    }

    setIsSubmittingIssue(true);
    try {
      const selectedAsset = assets.find(a => a.id === reportIssue.asset_id);

      const formData = new FormData();
      formData.append('title', reportIssue.title);
      formData.append('description', reportIssue.description);
      formData.append('priority', reportIssue.priority.toLowerCase());
      if (reportIssue.category) formData.append('category', reportIssue.category);
      if (reportIssue.asset_id) formData.append('asset_id', reportIssue.asset_id);
      if (selectedAsset?.department_id) formData.append('department_id', selectedAsset.department_id);

      attachments.forEach(file => {
        formData.append('attachments', file);
      });
      console.log('DEBUG: Submitting issue with', attachments.length, 'attachments');
      attachments.forEach((f, i) => console.log(`DEBUG: Attachment ${i}:`, f.name, f.size, f.type));

      const response = await issueService.create(formData);
      const created = response;

      // Manually add the new issue to state to update UI immediately
      // Note: We don't have the full enriched data yet, but basic fields work
      const enrichedCreated = {
        ...created,
        status: 'open',
        description: reportIssue.description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        assetName: selectedAsset ? selectedAsset.name : 'No Asset',
        assetId: reportIssue.asset_id || null
      };

      setIssues(prev => [enrichedCreated, ...prev]);
      try { await auditService.write({ user_id: user.id, action: 'issue.create', entity_type: 'issue', entity_id: created.id, details: { after: created } }); } catch { }

      // Backend will create a notification for the user automatically
      addToast({
        title: 'Issue Created',
        message: `Your issue "${reportIssue.title}" has been created successfully.`,
        type: 'success',
        duration: 5000
      });

      // Trigger notification refresh to immediately show the new notification
      window.dispatchEvent(new Event('refreshNotifications'));

      setReportIssue({ title: '', description: '', priority: 'Medium', category: '', asset_id: '' });
      setAttachments([]);
      setShowReportIssueModal(false);
    } catch (err) {
      console.error('Issue creation failed:', err);
      addToast({ title: 'Error', message: 'Failed to submit issue.', type: 'error', duration: 5000 });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const totalFiles = attachments.length + newFiles.length;
      if (totalFiles > 5) {
        addToast({ title: 'Error', message: 'You can only upload up to 5 files.', type: 'error' });
        return;
      }
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'in_progress':
      case 'pending_user_action':
      case 'pending_parts':
        return 'bg-yellow-100 text-yellow-800';
      case 'resolved':
      case 'closed':
        return 'bg-lightred text-primary';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Low':
        return 'bg-lightred text-primary';
      case 'Medium':
        return 'bg-lightblue text-secondary';
      case 'High':
        return 'bg-yellow-100 text-yellow-800';
      case 'Critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading issues...</p>
      </div>
    </div>;
  }
  return (
    <>
      <div className="space-y-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-primary">My Issues</h1>
              <p className="mt-2 text-gray-700 dark:text-gray-300">View and manage your reported issues.</p>
            </div>
            <button onClick={() => setShowReportIssueModal(true)} className="button-primary flex items-center"><span className="w-4 h-4 mr-2">+</span> Report New Issue</button>
          </div>
        </div>
        {/* Issue Status Summary */}
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
        </div>
        {/* Search and Filter */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <SearchIcon className="w-5 h-5 text-gray-400" />
                </div>
                <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Search issues..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FilterIcon className="w-5 h-5 text-gray-400" />
                </div>
                <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  {issueStatuses.map(status => <option key={status} value={status}>{status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FilterIcon className="w-5 h-5 text-gray-400" />
                </div>
                <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
                  {issuePriorities.map(priority => <option key={priority} value={priority}>{priority === 'All' ? 'All Priorities' : priority}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        {/* Issues List */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-primary">Your Reported Issues</h2>
              <span className="px-3 py-1 text-sm font-medium text-primary bg-lightred rounded-full">{filteredIssues.length} issues</span>
            </div>
          </div>
          {filteredIssues.length > 0 ? (
            <div className="space-y-4 p-6">
              {filteredIssues.map((issue) => (
                <div
                  key={issue.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6 hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-1 rounded-full ${issue.priority === 'Critical' ? 'bg-red-100 text-red-600' : issue.priority === 'High' ? 'bg-orange-100 text-orange-600' : issue.priority === 'Medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-lightred text-primary'}`}>
                          <InfoIcon className="w-4 h-4" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                          {issue.title}
                        </h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                          {issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <AlertCircleIcon className="w-4 h-4" />
                          <span>{issue.assetName || 'No Asset'}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <CalendarIcon className="w-4 h-4" />
                          <span>Reported: {new Date(issue.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                          <TagIcon className="w-4 h-4" />
                          <span>{issue.category || 'General'}</span>
                        </div>
                      </div>

                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                          Description:
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3 line-clamp-3">
                          {issue.description.length > 200
                            ? `${issue.description.substring(0, 200)}...`
                            : issue.description}
                        </p>
                      </div>

                      {issue.assetId && (
                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                            Related Asset:
                          </h4>
                          <Link to={`/user/assets/${issue.assetId}`} className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                            <div className="w-8 h-8 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 dark:border-gray-800">
                              <AssetImage
                                asset={assets.find(a => a.id === issue.assetId)}
                                assetType={assetRequestTypes.find(t => t.name === (assets.find(a => a.id === issue.assetId) as any)?.type)}
                              />
                            </div>
                            <span>{issue.assetName}</span>
                          </Link>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Last updated: {new Date(issue.updated_at).toLocaleDateString()}
                        </div>
                        <div className="flex items-center space-x-2">
                          {canEditIssue(issue) && (
                            <div className="flex items-center space-x-4">
                              <button
                                onClick={() => handleEditIssue(issue)}
                                className="flex items-center space-x-2 text-green-500 hover:text-green-400 transition-colors"
                                title="Edit Issue"
                              >
                                <EditIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">Edit</span>
                              </button>
                              <button
                                onClick={() => confirmDelete(issue.id)}
                                className="flex items-center space-x-2 text-red-500 hover:text-red-400 transition-colors"
                                title="Delete Issue"
                              >
                                <TrashIcon className="w-4 h-4" />
                                <span className="text-sm font-medium">Delete</span>
                              </button>
                            </div>
                          )}
                          {canManageIssue(issue) && (
                            <Link
                              to={`/user/issues/${issue.id}`}
                              className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark transition-colors"
                            >
                              Manage Issue
                            </Link>
                          )}
                          <Link
                            to={`/user/issues/${issue.id}`}
                            className="flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          >
                            <InfoIcon className="w-4 h-4" />
                            <span>View Details</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="flex flex-col items-center justify-center py-12">
            {searchTerm || filterStatus !== 'All' || filterPriority !== 'All' ? <>
              <AlertCircleIcon className="w-16 h-16 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-700">No matching issues found</h3>
              <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
              <button onClick={() => { setSearchTerm(''); setFilterStatus('All'); setFilterPriority('All'); }} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Clear Filters</button>
            </> : <>
              <CheckCircleIcon className="w-16 h-16 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-700">No issues reported</h3>
              <p className="mt-2 text-sm text-gray-500">You haven't reported any issues yet</p>
              <button onClick={() => setShowReportIssueModal(true)} className="button-primary px-4 py-2 mt-4 text-sm font-medium">Report New Issue</button>
            </>}
          </div>}
        </div>
        {/* Report Issue Modal */}
        {showReportIssueModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-lightred dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <AlertCircleIcon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-primary dark:text-white">Report an Issue</h3>
                </div>
                <button onClick={() => setShowReportIssueModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleReportIssueSubmit} className="overflow-y-auto max-h-[60vh] p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Issue Title *</label>
                    <input type="text" className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all" value={reportIssue.title} onChange={e => setReportIssue({ ...reportIssue, title: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                    <select className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all" value={reportIssue.priority} onChange={e => setReportIssue({ ...reportIssue, priority: e.target.value })}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Issue Category</label>
                    <select
                      className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                      value={reportIssue.category}
                      onChange={e => setReportIssue({ ...reportIssue, category: e.target.value })}
                      required
                      disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !reportIssue.category)}
                    >
                      <option value="">
                        {loadingIssueCategories
                          ? 'Loading categories...'
                          : activeIssueCategories.length
                            ? 'Select Issue Category'
                            : 'No active categories available'}
                      </option>
                      {activeIssueCategories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                      {!loadingIssueCategories && reportIssue.category && !issueCategories.some(category => category.name === reportIssue.category) && (
                        <option value={reportIssue.category}>{reportIssue.category}</option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Asset (optional)</label>
                    <select className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all" value={reportIssue.asset_id} onChange={e => setReportIssue({ ...reportIssue, asset_id: e.target.value })}>
                      <option value="">No Specific Asset</option>
                      {assets.map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
                  <textarea className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all resize-none" rows={5} value={reportIssue.description} onChange={e => setReportIssue({ ...reportIssue, description: e.target.value })} required />
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Attachments (Optional)</label>
                  <div className="flex items-center space-x-2">
                    <label className="cursor-pointer px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center">
                      <span className="mr-2">Choose Files</span>
                      <input type="file" multiple className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.txt" />
                    </label>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{attachments.length} files selected</span>
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                          <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{file.name}</span>
                          <button type="button" onClick={() => removeAttachment(index)} className="text-red-500 hover:text-red-700">
                            <XCircleIcon className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end space-x-3 border-t border-gray-200 dark:border-gray-800 pt-4">
                  <button type="button" onClick={() => setShowReportIssueModal(false)} className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmittingIssue} className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmittingIssue ? 'Submitting...' : 'Submit Issue'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Issue Modal */}
        {editingIssue && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Edit Issue</h3>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <XCircleIcon className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Title *
                    </label>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                      minLength={5}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Description *
                    </label>
                    <textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      rows={4}
                      required
                      minLength={10}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Status
                      </label>
                      <select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                        <option value="scheduled">Scheduled</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={editForm.priority}
                        onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Category
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !editForm.category)}
                    >
                      <option value="">
                        {loadingIssueCategories
                          ? 'Loading categories...'
                          : activeIssueCategories.length
                            ? 'Select Issue Category'
                            : 'No active categories available'}
                      </option>
                      {activeIssueCategories.map(category => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                      {!loadingIssueCategories && editForm.category && !issueCategories.some(category => category.name === editForm.category) && (
                        <option value={editForm.category}>{editForm.category}</option>
                      )}
                    </select>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                    >
                      {saving ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <SaveIcon className="w-4 h-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-card max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mr-4">
                    <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Issue</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">This action cannot be undone</p>
                  </div>
                </div>

                <p className="text-gray-700 dark:text-gray-300 mb-6">
                  Are you sure you want to delete this issue? This will permanently remove the issue and all its comments.
                </p>

                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDeleteIssue(showDeleteConfirm)}
                    disabled={deletingIssue === showDeleteConfirm}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
                  >
                    {deletingIssue === showDeleteConfirm ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete Issue
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
export default UserIssues;
