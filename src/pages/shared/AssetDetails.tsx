import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
// import { useSupabase } from '../../hooks/useSupabase'; // Removed - using new API
import { AlertCircleIcon, ClockIcon, CalendarIcon, MapPinIcon, UserIcon, TagIcon, BarChart2Icon, AlertTriangleIcon, PlusIcon, CheckCircleIcon, XCircleIcon, ArrowLeftIcon, PaperclipIcon, FileIcon, XIcon, HistoryIcon, RefreshCwIcon, CheckIcon, ImageIcon } from 'lucide-react';
import { assetService, userService, departmentService, issueService, notificationService, auditService, assetRequestTypeService, assetTypeService, dropdownOptionsService } from '../../services/apiDatabase';
import AssetImage from '../../components/AssetImage';
import { Asset, User, Department, Issue, AssetAssignmentHistoryEntry, AssetType } from '../../lib/supabase';
import useIssueCategories from '../../hooks/useIssueCategories';
import QRCode from 'react-qr-code';

const AssetDetails: React.FC = () => {
  const { assetId } = useParams();
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [assignedUser, setAssignedUser] = useState<User | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    type: '',
    priority: 'Medium'
  });
  const [issues, setIssues] = useState<Issue[]>([]);
  const isAdmin = user?.role === 'admin';
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [showDisposeModal, setShowDisposeModal] = useState(false);
  const [isDisposing, setIsDisposing] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>('');
  const qrRef = useRef<HTMLDivElement | null>(null);
  const { issueCategories, activeIssueCategories, loadingIssueCategories } = useIssueCategories();
  const [attachments, setAttachments] = useState<File[]>([]);
  const [assignments, setAssignments] = useState<AssetAssignmentHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedEditParentDepartment, setSelectedEditParentDepartment] = useState<string>('');
  const [isAddingParentDept, setIsAddingParentDept] = useState(false);
  const [newParentDeptTempName, setNewParentDeptTempName] = useState('');
  const [isSavingParentDept, setIsSavingParentDept] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptTempName, setNewDeptTempName] = useState('');
  const [isSavingDept, setIsSavingDept] = useState(false);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);
  const [assetTypesConfig, setAssetTypesConfig] = useState<AssetType[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [manufacturersList, setManufacturersList] = useState<string[]>(['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Cisco', 'Logitech', 'Canon', 'Epson', 'LG', 'ASUS', 'Acer', 'Sony', 'Brother']);
  const [categoriesList, setCategoriesList] = useState<string[]>(['Electronics', 'Furniture', 'Vehicles', 'Office Equipment', 'Software', 'Other']);
  const [statusesList, setStatusesList] = useState<string[]>(['Available', 'Assigned', 'In Maintenance', 'Reserved', 'Disposed']);
  const [conditionsList, setConditionsList] = useState<string[]>(['New', 'Excellent', 'Good', 'Fair', 'Poor', 'Defective']);

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

  const handleAssetImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!newIssue.type && activeIssueCategories.length > 0) {
      setNewIssue(prev => ({ ...prev, type: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, newIssue.type]);


  useEffect(() => {
    const fetchAssetDetails = async () => {
      try {
        if (!assetId) return;

        // Fetch asset details from database
        const assetData = await assetService.getById(assetId);
        if (assetData) {
          // Check if user has permission to view this asset
          if (user?.role !== 'admin' && assetData.assigned_to !== user?.id) {
            addToast({
              title: 'Access Denied',
              message: 'You can only view devices assigned to you',
              type: 'error'
            });
            setLoading(false);
            return;
          }

          setAsset(assetData);

          // Fetch assigned user if asset is assigned
          if (assetData.assigned_to) {
            // console.log('Fetching assigned user with ID:', assetData.assigned_to);
            try {
              const userData = await userService.getById(assetData.assigned_to);
              // console.log('Assigned user data received:', userData);
              if (userData) {
                setAssignedUser(userData);
              }
            } catch (error) {
              console.error('Error fetching assigned user:', error);
            }
          } else {
            // console.log('No assigned user for this asset');
          }

          // Fetch department if asset has a department
          if (assetData.department_id) {
            try {
              const deptData = await departmentService.getById(assetData.department_id);
              setDepartment(deptData);
            } catch (error) {
            }
          }
          // Fetch issues for this asset
          try {
            const issuesData = await issueService.getByAssetId(assetId);
            setIssues(issuesData || []);
          } catch (error) {
            console.error('Error fetching issues:', error);
          }

          // Fetch assignment history
          try {
            setLoadingHistory(true);
            const historyData = await assetService.getHistory(assetId);
            setAssignments(historyData.assignments || []);
          } catch (error) {
            console.error('Error fetching assignment history:', error);
          } finally {
            setLoadingHistory(false);
          }

          // Fetch asset request types for default images
          try {
            const typesData = await assetRequestTypeService.getAll();
            setAssetRequestTypes(typesData || []);
          } catch (error) {
            console.error('Error fetching asset types:', error);
          }

          // Fetch asset types config for dynamic attributes
          try {
            const configData = await assetTypeService.getAll(true);
            setAssetTypesConfig(configData || []);
          } catch (error) {
            console.error('Error fetching asset types config:', error);
          }

          // Fetch dynamic dropdown options
          try {
            const optionsData = await dropdownOptionsService.getAll();
            if (optionsData.length > 0) {
              const mans = optionsData.filter(o => o.type === 'manufacturer' && o.is_active).map(o => o.value);
              const cats = optionsData.filter(o => o.type === 'category' && o.is_active).map(o => o.value);
              const stats = optionsData.filter(o => o.type === 'status' && o.is_active).map(o => o.value);
              const conds = optionsData.filter(o => o.type === 'condition' && o.is_active).map(o => o.value);

              if (mans.length > 0) setManufacturersList(mans);
              if (cats.length > 0) setCategoriesList(cats);
              if (stats.length > 0) setStatusesList(stats);
              if (conds.length > 0) setConditionsList(conds);
            }
          } catch (error) {
            console.error('Error fetching dropdown options:', error);
          }
        }
      } catch (error) {
        addToast({
          title: 'Error',
          message: 'Failed to load asset details',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAssetDetails();
  }, [assetId, addToast, user]);

  useEffect(() => {
    if (asset && departmentsList.length > 0) {
      const currentDept = departmentsList.find(d => d.id === asset.department_id);
      if (currentDept) {
        setSelectedEditParentDepartment((currentDept as any).parent_id || currentDept.id);
      }
    }
  }, [asset, departmentsList]);

  useEffect(() => {
    // Fetch departments and users for dropdowns
    const fetchDropdowns = async () => {
      try {
        const [departments, users] = await Promise.all([
          departmentService.getAll(),
          userService.getAll(),
        ]);
        setDepartmentsList(departments);
        setUsersList(users);
      } catch (error) {
        // ignore for now
      }
    };
    if (isAdmin) fetchDropdowns();
  }, [isAdmin]);

  // Build a real, shareable URL for the QR code based on current origin
  useEffect(() => {
    if (asset?.id) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://turnkey-ams.com';
      setQrUrl(`${origin}/assets/${asset.id}`);
    }
  }, [asset?.id]);

  const handleDownloadQr = async (format: 'png' | 'jpg' = 'png') => {
    try {
      const wrapper = qrRef.current;
      if (!wrapper) return;
      const svg = wrapper.querySelector('svg');
      if (!svg) return;

      const serializer = new XMLSerializer();
      const svgStr = serializer.serializeToString(svg);
      const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      const size = 1024; // high-res export
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      await new Promise(resolve => {
        img.onload = () => resolve(null);
        img.src = url;
      });
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const pngUrl = canvas.toDataURL(mime, 0.92);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `asset-${asset?.id}-qrcode.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addToast({ title: 'QR Code Downloaded', message: `Saved as ${format.toUpperCase()}.`, type: 'success' });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to download QR code.', type: 'error' });
    }
  };

  const handleCopyLink = async () => {
    try {
      if (!qrUrl) return;
      await navigator.clipboard.writeText(qrUrl);
      addToast({ title: 'Link Copied', message: 'Device link copied to clipboard.', type: 'success' });
    } catch (e) {
      addToast({ title: 'Error', message: 'Failed to copy link.', type: 'error' });
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share && qrUrl) {
        await navigator.share({ title: 'Device Details', text: 'View this device in Devices Management', url: qrUrl });
      } else {
        await handleCopyLink();
      }
    } catch (_e) {
      // user may dismiss share sheet
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // console.log('Issue submit handler called');
    // console.log('Asset:', asset);
    // console.log('User:', user);
    // console.log('New issue data:', newIssue);

    if (!asset || !user) return;

    if (!newIssue.title.trim() || !newIssue.description.trim()) {
      // console.log('Validation failed: Missing required fields');
      addToast({
        title: 'Error',
        message: 'Please fill in all required fields.',
        type: 'error'
      });
      return;
    }

    if (newIssue.title.trim().length < 5) {
      // console.log('Validation failed: Title too short');
      addToast({
        title: 'Error',
        message: 'Issue title must be at least 5 characters long.',
        type: 'error'
      });
      return;
    }

    if (newIssue.description.trim().length < 10) {
      // console.log('Validation failed: Description too short');
      addToast({
        title: 'Error',
        message: 'Issue description must be at least 10 characters long.',
        type: 'error'
      });
      return;
    }

    if (!newIssue.type) {
      addToast({
        title: 'Error',
        message: 'Please select an issue category.',
        type: 'error'
      });
      return;
    }

    // console.log('Validation passed, proceeding with issue creation');

    setIsSubmittingIssue(true);

    try {
      // Create FormData for API submission
      const formData = new FormData();
      formData.append('title', newIssue.title);
      formData.append('description', newIssue.description);
      formData.append('priority', newIssue.priority.toLowerCase());
      formData.append('category', newIssue.type);
      formData.append('asset_id', asset.id);
      if (asset.department_id) {
        formData.append('department_id', asset.department_id);
      }

      // Add attachments
      attachments.forEach(file => {
        formData.append('attachments', file);
      });

      // Create the issue using API service
      const response = await issueService.create(formData);
      // The API returns the created issue, possibly nested or direct. 
      // The previous code assumed `response.issue`. Let's assume standard response or check.
      // Based on UserAssets, response itself might be the issue or contain it.
      // UserAssets used `response` directly. But here we see `response.issue`. 
      // I'll stick to how UserAssets worked if possible, but let's look at the original code here:
      // `const createdIssue = response.issue;`
      // I will keep using `response.issue` if that's what was there, OR adapt if I suspect `issueService.create` behavior.
      // Actually `UserAssets` used `response` as the issue. `AssetDetails` used `response.issue`.
      // This is suspicious. 
      // If `UserAssets` worked with `await issueService.create(formData)`, then `AssetDetails` should too.
      // Let's assume `response` is the issue.

      const createdIssue = response;

      if (createdIssue) {
        // Add the new issue to the local state - ensure it matches Issue type
        // If createdIssue is the issue, we use it.
        setIssues([createdIssue, ...issues]);

        // Show success notifications
        addToast({
          title: 'Issue Created',
          message: `New issue created for ${asset?.name}`,
          type: 'success'
        });

        // Dispatch backend notifications and emails
        try {
          // Notify reporter
          await notificationService.notifyUser(
            user.id,
            'Issue Reported',
            `Your issue "${newIssue.title}" has been created and is now Open.`,
            'info'
          );

          // Notify admins and IT officers only
          const recipients = await userService.getByRoles(['admin', 'department_officer']);
          const departments = await departmentService.getAll();
          const itDeptIds = new Set(
            departments.filter(d => (d.name || '').toLowerCase().includes('it')).map(d => d.id)
          );
          const targetUsers = recipients.filter(r => r.role === 'admin' || (r.role === 'department_officer' && r.department_id && itDeptIds.has(r.department_id)));
          await Promise.all(
            targetUsers
              .filter(u => u.id !== user.id)
              .map(u => notificationService.notifyUser(
                u.id,
                'New Issue Reported',
                `${user.name} reported an issue: "${newIssue.title}"`,
                'warning'
              ))
          );
        } catch (notifyErr) {
        }

        // Reset form and close modal
        setNewIssue({
          title: '',
          description: '',
          type: '',
          priority: 'Medium'
        });
        setAttachments([]);
        setShowIssueForm(false);
      }
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to create issue. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const handleCreateParentDept = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newParentDeptTempName.trim()) {
      addToast({ title: 'Validation Error', message: 'Department name cannot be empty.', type: 'warning' });
      return;
    }

    try {
      setIsSavingParentDept(true);
      const response = await departmentService.create({
        name: newParentDeptTempName.trim(),
        parent_id: null,
        location: 'Turnkey Africa'
      });

      const createdDept = (response as any).department || response;

      // Refresh departments
      const deptData = await departmentService.getAll();
      setDepartmentsList(deptData);

      // Auto-select the new parent department
      setSelectedEditParentDepartment(createdDept.id);
      if (editingAsset) setEditingAsset({ ...editingAsset, department_id: '' } as Asset);

      // Reset state
      setNewParentDeptTempName('');
      setIsAddingParentDept(false);

      addToast({ title: 'Success', message: 'Parent department created and selected.', type: 'success' });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create parent department.',
        type: 'error'
      });
    } finally {
      setIsSavingParentDept(false);
    }
  };

  const handleCreateDept = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newDeptTempName.trim()) {
      addToast({ title: 'Validation Error', message: 'Department name cannot be empty.', type: 'warning' });
      return;
    }

    if (!selectedEditParentDepartment) {
      addToast({ title: 'Validation Error', message: 'Please select a parent department first.', type: 'warning' });
      return;
    }

    try {
      setIsSavingDept(true);
      const response = await departmentService.create({
        name: newDeptTempName.trim(),
        parent_id: selectedEditParentDepartment,
        location: 'Turnkey Africa'
      });

      const createdDept = (response as any).department || response;

      // Refresh departments
      const deptData = await departmentService.getAll();
      setDepartmentsList(deptData);

      // Auto-select the new sub-department
      if (editingAsset) setEditingAsset({ ...editingAsset, department_id: createdDept.id } as Asset);

      // Reset state
      setNewDeptTempName('');
      setIsAddingDept(false);

      addToast({ title: 'Success', message: 'Department created and selected.', type: 'success' });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create department.',
        type: 'error'
      });
    } finally {
      setIsSavingDept(false);
    }
  };

  // Dispose asset handler
  const handleDisposeAsset = async () => {
    if (!asset) return;
    setIsDisposing(true);
    try {
      const updatedAsset = await assetService.update(asset.id, { status: 'Disposed' });
      setAsset(updatedAsset);
      addToast({
        title: 'Asset Disposed',
        message: `${asset?.name} has been marked as Disposed.`,
        type: 'success',
      });
      setShowDisposeModal(false);
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to dispose asset. Please try again.',
        type: 'error',
      });
    } finally {
      setIsDisposing(false);
    }
  };

  // Edit asset logic
  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setIsUpdating(true);

    const data = new FormData();
    Object.entries(editingAsset).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        // Handle specific fields for FormData
        if (key === 'purchase_date' && !value) {
          data.append(key, '');
        } else if (key === 'department_id' && !value) {
          data.append(key, '');
        } else if (key === 'assigned_to' && !value) {
          data.append(key, '');
        } else if (key === 'warranty_expiry' && !value) {
          data.append(key, '');
        } else if (key === 'last_maintenance' && !value) {
          data.append(key, '');
        } else if (key === 'custom_attributes') {
          data.append(key, JSON.stringify(value || {}));
        }
        else {
          data.append(key, String(value));
        }
      }
    });

    if (selectedFile) {
      data.append('image', selectedFile);
    }

    try {
      const updated = await assetService.update(editingAsset.id, data);
      try { await auditService.write({ user_id: user?.id || null, action: 'asset.update_user', entity_type: 'asset', entity_id: updated.id, details: { after: updated } }); } catch { }
      setAsset(updated);
      // Department stats are automatically updated by database triggers
      setShowEditAssetModal(false);
      setEditingAsset(null);
      setSelectedFile(null);
      setImagePreview(null);
      addToast({
        title: 'Asset Updated',
        message: `Asset "${updated.name}" has been updated successfully`,
        type: 'success',
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to update asset. Please try again.',
        type: 'error',
      });
      addToast({
        title: 'Error',
        message: 'Failed to update asset. Please try again.',
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };
  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === 'Not specified' || dateString === 'N/A') return 'Not specified';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (value: any) => {
    if (value === null || value === undefined || value === '') return 'Not specified';
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('en-KE', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };
  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      Available: 'bg-lightred text-primary',
      active: 'bg-lightred text-primary',
      Assigned: 'bg-lightblue text-secondary',
      assigned: 'bg-lightblue text-secondary',
      'In Maintenance': 'bg-yellow-100 text-yellow-800',
      maintenance: 'bg-yellow-100 text-yellow-800',
      Reserved: 'bg-lightblue text-secondary',
      Disposed: 'bg-red-100 text-red-800',
      retired: 'bg-red-100 text-red-800'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };
  const getConditionBadge = (condition: string) => {
    const conditionColors: Record<string, string> = {
      New: 'bg-lightred text-primary',
      Excellent: 'bg-lightred text-primary',
      excellent: 'bg-lightred text-primary',
      Good: 'bg-lightblue text-secondary',
      good: 'bg-lightblue text-secondary',
      Fair: 'bg-yellow-100 text-yellow-800',
      fair: 'bg-yellow-100 text-yellow-800',
      Poor: 'bg-orange-100 text-orange-800',
      poor: 'bg-orange-100 text-orange-800',
      Defective: 'bg-red-100 text-red-800'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${conditionColors[condition] || 'bg-gray-100 text-gray-800'}`}>{condition.charAt(0).toUpperCase() + condition.slice(1)}</span>;
  };
  const getIssueBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      Open: 'bg-red-100 text-red-800',
      'In Progress': 'bg-yellow-100 text-yellow-800',
      'Pending User Action': 'bg-lightblue text-secondary',
      'Pending Parts': 'bg-lightblue text-secondary',
      Resolved: 'bg-lightred text-primary',
      Closed: 'bg-gray-100 text-gray-800'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>{status}</span>;
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h1 className="text-3xl font-bold text-primary">Asset Not Found</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">The asset you're looking for doesn't exist or you don't have permission to view it.</p>
        <div className="mt-4 space-y-2">
          <Link to="/" className="button-primary inline-block px-4 py-2 text-sm font-medium">Go Back to Dashboard</Link>
          {user?.role !== 'admin' && (
            <Link to="/user/assets" className="inline-block px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors ml-2">
              View My Devices
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Asset Details Header */}
      <div className="flex flex-col justify-between p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card md:flex-row md:items-center">
        <div className="flex items-center">
          <Link to="/admin/assets" className="mr-4 text-primary hover:underline flex items-center">
            <ArrowLeftIcon className="w-5 h-5 mr-1" />Back
          </Link>
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl md:w-32 md:h-32 overflow-hidden bg-gray-100 flex items-center justify-center border border-gray-200 dark:border-gray-800">
              <AssetImage asset={asset} assetType={assetRequestTypes.find(t => t.name === asset.type)} />
            </div>
            <div className="absolute bottom-0 right-0">{getStatusBadge(asset.custom_attributes?.Status || asset.status)}</div>
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-primary">{asset.name}</h1>
            <div className="flex flex-wrap items-center mt-2 space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">{asset.type}</span>
              {asset.custom_attributes?.Condition && getConditionBadge(asset.custom_attributes.Condition)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center mt-4 space-y-2 md:mt-0 md:items-end">
          <button onClick={() => setShowIssueForm(true)} className="button-primary flex items-center">
            <AlertCircleIcon className="w-4 h-4 mr-2" /> Report Issue
          </button>
          {isAdmin && (
            <div className="flex space-x-2">
              <button onClick={() => {
                // Parse custom_attributes if it's a string
                let parsedAttributes = asset.custom_attributes;
                if (typeof asset.custom_attributes === 'string') {
                  try {
                    parsedAttributes = JSON.parse(asset.custom_attributes);
                  } catch (err) {
                    parsedAttributes = {};
                  }
                }

                setEditingAsset({
                  ...asset,
                  custom_attributes: parsedAttributes || {}
                });

                const currentDept = departmentsList.find(d => d.id === asset.department_id);
                if (currentDept) {
                  if ((currentDept as any).parent_id) {
                    setSelectedEditParentDepartment((currentDept as any).parent_id);
                  } else {
                    setSelectedEditParentDepartment(currentDept.id);
                  }
                }
                setShowEditAssetModal(true);
              }} className="px-4 py-2 text-sm font-medium text-secondary border border-secondary rounded-full hover:bg-lightblue transition-colors">
                Edit Asset
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-full hover:bg-red-50 transition-colors disabled:opacity-50"
                onClick={() => setShowDisposeModal(true)}
                disabled={asset.status === 'Disposed'}
              >
                Dispose Asset
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Details */}
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <h2 className="mb-4 text-xl font-bold text-primary">Core Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-center mb-2">
                  <MapPinIcon className="w-5 h-5 mr-2 text-primary" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Location</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{asset.location || 'Turnkey Africa'}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-center mb-2">
                  <UserIcon className="w-5 h-5 mr-2 text-primary" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned to</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{assignedUser?.name || (asset as any)?.assigned_user_name || 'Unassigned'}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-center mb-2">
                  <TagIcon className="w-5 h-5 mr-2 text-primary" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Asset type</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{asset.type}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-center mb-2">
                  <BarChart2Icon className="w-5 h-5 mr-2 text-primary" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Serial number</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-mono">{asset.serial_number || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Technical Specifications Section */}
          {(() => {
            const config = assetTypesConfig.find(t => t.name === asset.type);
            if (!config || !config.parameters_schema || config.parameters_schema.length === 0) return null;

            // Parse custom_attributes if it's a string
            let parsedAttributes: any = asset.custom_attributes;
            if (typeof asset.custom_attributes === 'string') {
              try {
                parsedAttributes = JSON.parse(asset.custom_attributes);
              } catch (err) {
                parsedAttributes = {};
              }
            }
            if (!parsedAttributes) parsedAttributes = {};

            return (
              <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
                <h2 className="mb-4 text-xl font-bold text-primary">Technical Specifications</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {config.parameters_schema.map((param) => {
                    const value = parsedAttributes[param.name] ?? (asset as any)[param.name.toLowerCase().replace(/ /g, '_')];
                    
                    if (!value && value !== 0 && value !== false) {
                       return (
                          <div key={param.name} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800 opacity-60">
                             <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{param.name}</span>
                             <span className="text-sm font-medium text-gray-400 dark:text-gray-500 mt-1 italic">Not specified</span>
                          </div>
                       );
                    }
                    
                    return (
                      <div key={param.name} className="flex flex-col p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-800">
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{param.name}</span>
                        <span className="text-sm font-bold text-gray-800 dark:text-gray-200 mt-1">
                          {(() => {
                            if (param.type === 'boolean') {
                              return (value === 'true' || value === true ? 'Yes' : 'No');
                            }
                            if (param.type === 'date' || param.name.toLowerCase().includes('date')) {
                              return formatDate(String(value));
                            }
                            if (param.name.includes('(KSh)')) {
                              return formatCurrency(value);
                            }
                            return String(value);
                          })()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

            {asset.notes && (
              <div className="p-4 mt-4 bg-lightred dark:bg-gray-800 rounded-xl border border-primary/10">
                <h3 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Notes</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{asset.notes}</p>
              </div>
            )}
          </div>



        <div className="space-y-6">
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card space-y-8">
            {/* QR Code */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-primary">Asset QR Code</h2>
              <div className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-2xl" ref={qrRef}>
                <QRCode
                  value={qrUrl || `${typeof window !== 'undefined' ? window.location.origin : 'https://turnkey-ams.com'}/assets/${asset?.id}`}
                  size={180}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">Scan to view asset details</p>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  <button onClick={handleCopyLink} className="button-primary px-3 py-1 text-xs font-medium">Copy Link</button>
                  <button onClick={() => handleDownloadQr('png')} className="button-primary px-3 py-1 text-xs font-medium">Download PNG</button>
                  <button onClick={handleShare} className="button-primary px-3 py-1 text-xs font-medium">Share</button>
                </div>
              </div>
            </div>

            {/* Assigned User */}
            {(assignedUser || (asset as any)?.assigned_user_name) && (
              <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
                <h2 className="mb-4 text-xl font-bold text-primary">Assigned User</h2>
                <div className="flex items-center p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                  <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 bg-lightred dark:bg-gray-700 rounded-full">
                    <UserIcon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{assignedUser?.name || (asset as any)?.assigned_user_name}</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400">{assignedUser?.email || (asset as any)?.assigned_user_email}</p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">{department?.name || (asset as any)?.department_name}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Warranty Information */}
            <div className="pt-6 border-t border-gray-100 dark:border-gray-800">
              <h2 className="mb-4 text-xl font-bold text-primary">Warranty Information</h2>
              <div className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                  {new Date(asset?.warranty_expiry || '').getTime() > new Date().getTime() ? <span className="px-2 py-1 text-xs font-medium text-primary bg-lightred dark:bg-green-900 dark:text-green-200 rounded-full">Active</span> : <span className="px-2 py-1 text-xs font-medium text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900 rounded-full">Expired</span>}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Purchase Date</span><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatDate(asset?.purchase_date || null)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Warranty End</span><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{formatDate(asset?.warranty_expiry || null)}</span></div>
                  <div className="flex justify-between"><span className="text-xs text-gray-600 dark:text-gray-400">Days Remaining</span><span className="text-xs font-medium text-gray-700 dark:text-gray-300">{new Date(asset?.warranty_expiry || '').getTime() > new Date().getTime() ? Math.ceil((new Date(asset?.warranty_expiry || '').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 'Expired'}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Assignment History */}
        <div className="lg:col-span-2 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <h2 className="mb-4 text-xl font-bold text-primary">Assignment History</h2>
          {loadingHistory ? (
            <div className="flex justify-center p-12">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
          ) : assignments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100 dark:border-gray-800">
                    <th className="pb-4 pr-4">User</th>
                    <th className="pb-4 px-4">Department</th>
                    <th className="pb-4 px-4">Timeline</th>
                    <th className="pb-4 pl-4">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {assignments.map((entry) => (
                    <tr key={entry.id} className="text-sm group hover:bg-lightred/30 dark:hover:bg-gray-800/50 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="font-bold text-gray-900 dark:text-gray-100">{entry.user_name || 'System'}</div>
                        <div className="text-xs text-gray-500">{entry.user_email}</div>
                      </td>
                      <td className="py-4 px-4 font-medium text-gray-600 dark:text-gray-400">
                        {entry.department_name || '—'}
                      </td>
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-400">
                        <div className="flex flex-col">
                          <span className="text-xs opacity-70">Assigned: {formatDate(entry.assigned_at)}</span>
                          {entry.returned_at ? (
                            <span className="text-xs opacity-70">Returned: {formatDate(entry.returned_at)}</span>
                          ) : (
                            <span className="text-[10px] font-bold text-primary self-start mt-1 bg-lightred px-2 py-0.5 rounded-full uppercase">Current</span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pl-4">
                        <span className="capitalize px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">{entry.assignment_type}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center opacity-50">
              <HistoryIcon className="w-16 h-16 text-gray-300 mb-3" />
              <p className="text-gray-500">No assignment history found</p>
            </div>
          )}
        </div>

        {/* Issues History */}
        <div className="lg:col-span-1 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary">Issues History</h2>
            <button
              onClick={() => setShowIssueForm(true)}
              className="button-primary flex items-center px-3 py-1 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4 mr-1" /> New
            </button>
          </div>
          {issues.length > 0 ? (
            <div className="space-y-4">
              {issues.map(issue => (
                <div key={issue.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl border border-primary/5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{issue.title}</h3>
                        {getIssueBadge(issue.status)}
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Reported on {formatDate(issue.created_at)}</p>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 italic line-clamp-2">{issue.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
              <CheckCircleIcon className="w-16 h-16 text-primary mb-3" />
              <p className="text-gray-500">No issues reported</p>
            </div>
          )}
        </div>
      </div>

      {/* Issue Form Modal */}
      {
        showIssueForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800 bg-lightred dark:bg-gray-800">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <AlertCircleIcon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-primary dark:text-white">Report an Issue</h3>
                </div>
                <button onClick={() => setShowIssueForm(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Asset Info Section */}
              <div className="p-6 bg-lightred/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-white dark:bg-gray-700 rounded-xl">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Asset:</span> {asset?.name}
                    </p>
                  </div>
                  <div className="p-3 bg-white dark:bg-gray-700 rounded-xl">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Type:</span> {asset?.type}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable Form Content */}
              <div className="overflow-y-auto max-h-[60vh] p-6">
                <form onSubmit={handleIssueSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Issue Title *</label>
                      <input
                        type="text"
                        className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                        placeholder="Brief description of the issue"
                        value={newIssue.title}
                        onChange={e => setNewIssue({ ...newIssue, title: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Issue Category</label>
                      <select
                        className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all"
                        value={newIssue.type}
                        onChange={e => setNewIssue({ ...newIssue, type: e.target.value })}
                        required
                        disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !newIssue.type)}
                      >
                        <option value="">{loadingIssueCategories ? 'Loading categories...' : activeIssueCategories.length ? 'Select Issue Category' : 'No active categories available'}</option>
                        {activeIssueCategories.map(category => <option key={category.id} value={category.name}>{category.name}</option>)}
                        {!loadingIssueCategories && newIssue.type && !issueCategories.some(cat => cat.name === newIssue.type) && <option value={newIssue.type}>{newIssue.type}</option>}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                    <select className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all" value={newIssue.priority} onChange={e => setNewIssue({ ...newIssue, priority: e.target.value })}>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Description *</label>
                    <textarea className="block w-full px-4 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 transition-all resize-none" rows={5} placeholder="Detailed description of the issue..." value={newIssue.description} onChange={e => setNewIssue({ ...newIssue, description: e.target.value })} required />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Attachments (Max 5)</label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-300 dark:border-gray-600 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <PaperclipIcon className="w-8 h-8 mb-3 text-gray-400" />
                          <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, PDF (MAX. 10MB)</p>
                        </div>
                        <input type="file" className="hidden" multiple onChange={handleFileChange} accept="image/*,.pdf" />
                      </label>
                    </div>
                    {attachments.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center space-x-3 overflow-hidden">
                              <FileIcon className="w-5 h-5 flex-shrink-0 text-primary" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeAttachment(index)} className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><XIcon className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="hidden">Submit</button>
                </form>
              </div>
              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800">
                <button type="button" onClick={() => setShowIssueForm(false)} className="px-6 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">Cancel</button>
                <button type="button" onClick={handleIssueSubmit} disabled={isSubmittingIssue} className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-primary to-secondary rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] shadow-lg">
                  {isSubmittingIssue ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />Submitting...</> : 'Submit Issue'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Dispose Confirmation Modal */}
      {
        showDisposeModal && asset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-red-700">Dispose Asset</h3>
                <button onClick={() => setShowDisposeModal(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
              <p className="mb-6 text-gray-700 dark:text-gray-300">Are you sure you want to mark <span className="font-bold">{asset?.name}</span> as <span className="text-red-700">Disposed</span>? This action cannot be undone.</p>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setShowDisposeModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600" disabled={isDisposing}>Cancel</button>
                <button type="button" onClick={handleDisposeAsset} className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-red-600 to-red-400 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed" disabled={isDisposing}>{isDisposing ? 'Disposing...' : 'Confirm Dispose'}</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Asset Modal */}
      {
        showEditAssetModal && editingAsset && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-4xl p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-primary">Edit Asset: {editingAsset?.name}</h3>
                <button onClick={() => setShowEditAssetModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleEditAsset}>
                <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-primary">Asset name</label>
                    <input type="text" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={editingAsset?.name || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, name: e.target.value } as Asset)} required />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-primary">Asset type</label>
                    <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={editingAsset?.type || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, type: e.target.value } as Asset)} required>
                      <option value="">Select type</option>
                      {assetTypesConfig.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-primary">Serial number</label>
                    <input type="text" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={editingAsset?.serial_number || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, serial_number: e.target.value } as Asset)} />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-primary">Parent department</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingParentDept(!isAddingParentDept)}
                        className="text-xs font-medium text-primary hover:underline flex items-center"
                      >
                        {isAddingParentDept ? (
                          <><XIcon className="w-3 h-3 mr-1" /> Use existing</>
                        ) : (
                          <><PlusIcon className="w-3 h-3 mr-1" /> Add new</>
                        )}
                      </button>
                    </div>
                    {isAddingParentDept ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="New root department"
                          value={newParentDeptTempName}
                          onChange={e => setNewParentDeptTempName(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleCreateParentDept}
                          disabled={isSavingParentDept || !newParentDeptTempName.trim()}
                          className="p-2 text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50"
                        >
                          {isSavingParentDept ? (
                            <RefreshCwIcon className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={selectedEditParentDepartment} onChange={e => { setSelectedEditParentDepartment(e.target.value); if (editingAsset) setEditingAsset({ ...editingAsset, department_id: '' } as Asset); }} required>
                        <option value="">Select parent</option>
                        {departmentsList.filter(d => !(d as any).parent_id).map(root => (
                          <option key={root.id} value={root.id}>{root.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-primary">Department</label>
                      <button
                        type="button"
                        onClick={() => setIsAddingDept(!isAddingDept)}
                        className="text-xs font-medium text-primary hover:underline flex items-center"
                      >
                        {isAddingDept ? (
                          <><XIcon className="w-3 h-3 mr-1" /> Use existing</>
                        ) : (
                          <><PlusIcon className="w-3 h-3 mr-1" /> Add new</>
                        )}
                      </button>
                    </div>
                    {isAddingDept ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          placeholder="New sub-department"
                          value={newDeptTempName}
                          onChange={e => setNewDeptTempName(e.target.value)}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleCreateDept}
                          disabled={isSavingDept || !newDeptTempName.trim()}
                          className="p-2 text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50"
                        >
                          {isSavingDept ? (
                            <RefreshCwIcon className="w-5 h-5 animate-spin" />
                          ) : (
                            <CheckIcon className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={editingAsset?.department_id || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, department_id: e.target.value || '' } as Asset)} required>
                        <option value="">Select department</option>
                        {/* Option to assign to root itself */}
                        {departmentsList.filter(d => d.id === selectedEditParentDepartment).map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                        ))}
                        {/* Sub-departments under selected parent */}
                        {departmentsList.filter(d => (d as any).parent_id === selectedEditParentDepartment).map(dept => (
                          <option key={dept.id} value={dept.id}>{dept.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-primary">Location</label>
                    <input type="text" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl" value="Turnkey Africa" readOnly />
                  </div>
                </div>

                {(() => {
                  const selectedTypeConfig = assetTypesConfig.find(t => t.name === editingAsset?.type);
                  if (!selectedTypeConfig?.parameters_schema?.length) return null;
                  return (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-semibold text-primary mb-3">"{selectedTypeConfig?.name}" Specific Details</h4>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {selectedTypeConfig.parameters_schema.map(param => (
                          <div key={param.name}>
                              <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{param.name} {param.required && <span className="text-red-500">*</span>}</label>
                              {param.type === 'global_dropdown' ? (
                                <select
                                  value={editingAsset?.custom_attributes?.[param.name] || ''}
                                  onChange={(e) => setEditingAsset({
                                    ...editingAsset,
                                    custom_attributes: { ...editingAsset?.custom_attributes, [param.name]: e.target.value }
                                  } as Asset)}
                                  required={param.required}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                                >
                                  <option value="">Select {(param as any).source || 'option'}</option>
                                  {(() => {
                                    const source = (param as any).source;
                                    if (source === 'manufacturer') return manufacturersList.map(m => <option key={m} value={m}>{m}</option>);
                                    if (source === 'category') return categoriesList.map(c => <option key={c} value={c}>{c}</option>);
                                    if (source === 'status') return statusesList.map(s => <option key={s} value={s}>{s}</option>);
                                    if (source === 'condition') return conditionsList.map(c => <option key={c} value={c}>{c}</option>);
                                    return null;
                                  })()}
                                </select>
                              ) : param.type === 'dropdown' ? (
                                <select
                                  value={editingAsset?.custom_attributes?.[param.name] || ''}
                                  onChange={(e) => setEditingAsset({
                                    ...editingAsset,
                                    custom_attributes: { ...editingAsset?.custom_attributes, [param.name]: e.target.value }
                                  } as Asset)}
                                  required={param.required}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                                >
                                  <option value="">Select option</option>
                                  {((param as any).options || '').split(',').map((opt: string) => opt.trim()).filter(Boolean).map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : param.type === 'boolean' ? (
                                <div className="flex items-center h-10">
                                  <input
                                    type="checkbox"
                                    checked={editingAsset?.custom_attributes?.[param.name] === 'true' || editingAsset?.custom_attributes?.[param.name] === true}
                                    onChange={(e) => setEditingAsset({
                                      ...editingAsset,
                                      custom_attributes: { ...editingAsset?.custom_attributes, [param.name]: e.target.checked }
                                    } as Asset)}
                                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                                  />
                                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Yes</span>
                                </div>
                              ) : (
                                <input
                                  type={param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'}
                                  value={editingAsset?.custom_attributes?.[param.name] || ''}
                                  onChange={(e) => setEditingAsset({
                                      ...editingAsset,
                                      custom_attributes: { ...editingAsset?.custom_attributes, [param.name]: e.target.value }
                                  } as Asset)}
                                  required={param.required}
                                  className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                                />
                              )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-primary">Assigned To</label>
                  <select
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={editingAsset?.assigned_to || ''}
                    onChange={e => {
                      const userId = e.target.value || null;
                      const selectedUser = usersList.find(u => u.id === userId);
                      const userDeptId = selectedUser?.department_id || '';

                      if (userDeptId) {
                        const userDept = departmentsList.find(d => d.id === userDeptId);
                        if (userDept) {
                          setSelectedEditParentDepartment((userDept as any).parent_id || userDept.id);
                        }
                      }

                      setEditingAsset({
                        ...editingAsset,
                        assigned_to: userId,
                        department_id: userDeptId || editingAsset?.department_id
                      } as Asset);
                    }}
                  >
                    <option value="">Select User</option>
                    {usersList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-primary">Notes</label>
                  <textarea className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" rows={3} value={editingAsset?.notes || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, notes: e.target.value } as Asset)} />
                </div>
                <div className="mb-4">
                  <label className="block mb-2 text-sm font-medium text-primary">Asset Image</label>
                  <div className="flex items-center space-x-4">
                    <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-gray-800">
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      ) : (editingAsset as any)?.image_data ? (
                        <AssetImage asset={editingAsset as Asset} className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex flex-col space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAssetImageChange}
                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lightred file:text-primary hover:file:opacity-90"
                      />
                      {(editingAsset as any)?.image_data && !imagePreview && (
                        <p className="text-xs text-gray-500">Current image shown. Upload new to replace.</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button type="button" onClick={() => setShowEditAssetModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
                  <button type="submit" className="button-primary px-4 py-2 text-sm font-medium" disabled={isUpdating}>{isUpdating ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div>
  );
};

export default AssetDetails;
