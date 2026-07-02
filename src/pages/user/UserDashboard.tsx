import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { MonitorIcon, AlertCircleIcon, CheckCircleIcon, ClockIcon, InfoIcon, ArrowRightIcon, BellIcon, XCircleIcon, PaperclipIcon, FileIcon, XIcon } from 'lucide-react';
import { assetService, issueService, notificationService, userService, assetRequestsService, auditService, assetRequestTypeService } from '../../services/apiDatabase';
import { AssetRequestType } from '../../lib/supabase';
import AssetImage from '../../components/AssetImage';
import useIssueCategories from '../../hooks/useIssueCategories';

const UserDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addNotification, addToast } = useNotifications();

  const [assets, setAssets] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [loading, setLoading] = useState(true);

  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [reportIssue, setReportIssue] = useState({
    title: '',
    description: '',
    priority: 'Medium',
    category: '',
    asset_id: ''
  });

  const [showRequestAssetModal, setShowRequestAssetModal] = useState(false);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [assetRequest, setAssetRequest] = useState({ title: '', description: '', type: 'Laptop', priority: 'Medium' });
  const { issueCategories, activeIssueCategories, loadingIssueCategories } = useIssueCategories();
  const [attachments, setAttachments] = useState<File[]>([]);

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

  useEffect(() => {
    if (!reportIssue.category && activeIssueCategories.length > 0) {
      setReportIssue(prev => ({ ...prev, category: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, reportIssue.category]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!user?.id) {
          setAssets([]);
          setIssues([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        // Fetch data concurrently
        const [assignedAssets, reportedIssues, types] = await Promise.all([
          assetService.getByAssignedUser(user.id, 100),
          issueService.getByReporter(user.id, 100),
          assetRequestTypeService.getAll()
        ]);

        setAssets(assignedAssets);
        setAssetRequestTypes(types || []);

        // Enrich with asset names using API service
        const assetIds = Array.from(new Set((reportedIssues || []).map((i: any) => i.asset_id).filter(Boolean)));
        let idToAssetName = new Map<string, string>();
        if (assetIds.length > 0) {
          try {
            const assetsForIssues = await assetService.getAll();
            assetsForIssues.forEach((a: any) => {
              if (assetIds.includes(a.id)) {
                idToAssetName.set(a.id, a.name);
              }
            });
          } catch { }
        }
        const enriched = (reportedIssues || []).map((i: any) => ({
          ...i,
          assetName: i.asset_id ? (idToAssetName.get(i.asset_id) || i.asset_id) : 'No device'
        }));
        setIssues(enriched);

        // Keep UX toast but don't include it in dependencies to avoid loops
        addToast({
          title: 'Dashboard Loaded',
          message: 'Your dashboard has been loaded successfully.',
          type: 'success',
          duration: 2000
        });
      } catch (error) {
        addNotification({
          title: 'Error',
          message: 'Failed to load dashboard data',
          type: 'error'
        });
        addToast({
          title: 'Error',
          message: 'Failed to load dashboard data.',
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  const handleReportIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!reportIssue.title.trim() || !reportIssue.description.trim()) return;

    if (reportIssue.title.trim().length < 5) {
      addNotification({
        title: 'Error',
        message: 'Issue title must be at least 5 characters long.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Issue title must be at least 5 characters long.',
        type: 'error',
        duration: 5000
      });
      return;
    }

    if (reportIssue.description.trim().length < 10) {
      addNotification({
        title: 'Error',
        message: 'Issue description must be at least 10 characters long.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Issue description must be at least 10 characters long.',
        type: 'error',
        duration: 5000
      });
      return;
    }

    if (!reportIssue.category) {
      addNotification({
        title: 'Error',
        message: 'Please select an issue category.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Please select an issue category.',
        type: 'error',
        duration: 5000
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
      formData.append('category', reportIssue.category);
      if (reportIssue.asset_id) formData.append('asset_id', reportIssue.asset_id);
      if (selectedAsset?.department_id) formData.append('department_id', selectedAsset.department_id);

      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      // Use formData instead of object
      const created = await issueService.create(formData);
      setIssues(prev => [created, ...prev]);
      try { await auditService.write({ user_id: user.id, action: 'issue.create', entity_type: 'issue', entity_id: created.id, details: { after: created } }); } catch { }

      // Backend automatically handles all notifications (in-app and email)
      // for the user, managers, and admins

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
      addToast({
        title: 'Error',
        message: 'Failed to submit issue.',
        type: 'error',
        duration: 5000
      });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleRequestAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (!assetRequest.title.trim() || !assetRequest.description.trim()) return;
    setIsSubmittingRequest(true);
    try {
      const created = await assetRequestsService.create({
        user_id: user.id,
        asset_name: assetRequest.title,
        asset_type: assetRequest.type,
        category: 'Electronics', // Default category
        reason: assetRequest.description,
        priority: assetRequest.priority.toLowerCase(),
        notes: null
      });
      // Notify admins/managers
      try {
        const recipients = await userService.getByRoles(['admin', 'department_officer']);
        await Promise.all(
          recipients.map(u => notificationService.notifyUser(
            u.id,
            'New Device Request',
            `${user.name} requested a new device: "${assetRequest.title}" (${assetRequest.type}).`,
            'warning'
          ))
        );
        await notificationService.notifyUser(
          user.id,
          'Device Request Submitted',
          `Your device request "${assetRequest.title}" has been submitted for review.`,
          'info'
        );
      } catch (e) { /* Failed to send asset request notifications */ }
      setAssetRequest({ title: '', description: '', type: 'Laptop', priority: 'Medium' });
      setShowRequestAssetModal(false);
      addToast({ title: 'Request Submitted', message: 'Your device request has been submitted.', type: 'success' });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to submit device request.', type: 'error' });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const getStatusColor = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'available':
      case 'assigned':
      case 'resolved':
      case 'closed':
        return 'bg-lightred text-primary';
      case 'in maintenance':
      case 'in progress':
      case 'pending user action':
      case 'pending parts':
        return 'bg-yellow-100 text-yellow-800';
      case 'disposed':
      case 'open':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h1 className="text-3xl font-bold text-primary">Welcome back, {user?.name}</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">Here's an overview of your assigned devices and recent issues.</p>
      </div>

      {/* Quick Actions */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link to="/user/assets" className="button-primary flex items-center justify-center">
            <MonitorIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">View All Devices</span>
          </Link>
          <button onClick={() => setShowReportIssueModal(true)} className="button-primary flex items-center justify-center">
            <AlertCircleIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Report an Issue</span>
          </button>
          <Link to="/notifications" className="button-primary flex items-center justify-center">
            <BellIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Notifications</span>
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Removed Request New Asset button */}
        </div>
      </div>

      {/* Request Asset Modal */}
      {/* Removed Request Asset Modal */}

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightblue rounded-full">
              <MonitorIcon className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Assigned Devices</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{assets.length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <AlertCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Open Issues</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(i => (i?.status || '').toLowerCase() === 'open').length}</p>
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
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(i => (i?.status || '').toLowerCase() === 'in progress').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightred rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Resolved Issues</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{issues.filter(i => ['resolved', 'closed'].includes((i?.status || '').toLowerCase())).length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Your Assets */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Your Devices</h2>
          <Link to="/user/assets" className="button-primary flex items-center text-sm font-medium">
            View All <ArrowRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-lightred dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3">Device</th>
                <th scope="col" className="px-6 py-3">Type</th>
                <th scope="col" className="px-6 py-3">Serial Number</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Location</th>
              </tr>
            </thead>
            <tbody>
              {assets.slice(0, 5).map(asset => (
                <tr key={asset.id} className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-lightred/50 dark:hover:bg-gray-800/60">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                    <Link to={`/assets/${asset.id}`} className="flex items-center">
                      <div className="w-10 h-10 mr-3 bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 flex-shrink-0">
                        <AssetImage
                          asset={asset}
                          assetType={assetRequestTypes.find(t => t.name === asset.type)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="truncate max-w-[200px]">{asset.name}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4">{asset.type}</td>
                  <td className="px-6 py-4">{asset.serial_number}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>{asset.status}</span>
                  </td>
                  <td className="px-6 py-4">{asset.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Issues */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Recent Issues</h2>
          <Link to="/user/issues" className="button-primary flex items-center text-sm font-medium">
            View All <ArrowRightIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-lightblue dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3">Issue</th>
                <th scope="col" className="px-6 py-3">Device</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Created</th>
                <th scope="col" className="px-6 py-3">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {issues.slice(0, 5).map(issue => (
                <tr key={issue.id} className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-lightblue/50 dark:hover:bg-gray-800/60">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`p-1 mr-3 rounded-full ${issue.priority === 'Critical' ? 'bg-red-100 text-red-600' : issue.priority === 'High' ? 'bg-orange-100 text-orange-600' : issue.priority === 'Medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-lightred text-primary'}`}>
                        <InfoIcon className="w-4 h-4" />
                      </div>
                      <span>{issue.title}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {issue.asset_id ? (
                      <Link to={`/assets/${issue.asset_id}`} className="flex items-center">
                        <div className="w-10 h-10 mr-3 bg-white dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-800 flex-shrink-0">
                          {(() => {
                            const asset = assets.find(a => a.id === issue.asset_id);
                            return (
                              <AssetImage
                                asset={asset}
                                assetType={assetRequestTypes.find(t => t.name === asset?.type)}
                                className="w-full h-full object-cover"
                              />
                            );
                          })()}
                        </div>
                        <span className="truncate max-w-[150px]">{issue.assetName}</span>
                      </Link>
                    ) : (
                      <span className="text-gray-400">No Device</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>{issue.status}</span>
                  </td>
                  <td className="px-6 py-4">{new Date(issue.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4">{new Date(issue.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                    <option value="">No Specific Device</option>
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

              {/* Attachments Section */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Attachments (Max 5)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <PaperclipIcon className="w-8 h-8 mb-3 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        PNG, JPG, PDF (MAX. 10MB)
                      </p>
                    </div>
                    <input type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,.pdf" />
                  </label>
                </div>

                {/* Selected Files List */}
                {attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center space-x-3 overflow-hidden">
                          <FileIcon className="w-5 h-5 flex-shrink-0 text-primary" />
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachment(index)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                          <XIcon className="w-4 h-4" />
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
    </div>
  );
};

export default UserDashboard;
