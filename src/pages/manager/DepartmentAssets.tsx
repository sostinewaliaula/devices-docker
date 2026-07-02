import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  MonitorIcon, 
  SearchIcon, 
  FilterIcon, 
  EyeIcon, 
  AlertCircleIcon,
  PlusIcon,
  TrendingUpIcon,
  CalendarIcon,
  UserIcon,
  BuildingIcon,
  CheckCircleIcon,
  ClockIcon,
  ArchiveIcon,
  DownloadIcon
} from 'lucide-react';
import Logo from '../../assets/logo.png';
import { assetService, userService, issueService, assetRequestsService, assetRequestTypeService } from '../../services/apiDatabase';
import { Asset, User, Issue, AssetRequestType } from '../../lib/supabase';
import useIssueCategories from '../../hooks/useIssueCategories';

const DepartmentAssets: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showAssetModal, setShowAssetModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    priority: 'medium',
    asset_id: ''
  });
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [newAssetRequest, setNewAssetRequest] = useState({
    asset_name: '',
    asset_type: '',
    category: '',
    manufacturer: '',
    model: '',
    reason: '',
    priority: 'medium',
    requested_for: '',
    quantity: 1,
    notes: ''
  });
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [loadingAssetTypes, setLoadingAssetTypes] = useState(true);
  const activeAssetTypes = useMemo(
    () => assetRequestTypes.filter((type) => type.is_active),
    [assetRequestTypes]
  );
  const { issueCategories, activeIssueCategories, loadingIssueCategories } = useIssueCategories();

  useEffect(() => {
    if (!user?.department_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fAssets, fTeamMembers, fIssues] = await Promise.all([
          assetService.getByDepartment(user.department_id!),
          userService.getByDepartment(user.department_id!),
          issueService.getAll()
        ]);

        // Filter issues for department assets
        const departmentAssetIds = fAssets.map(asset => asset.id);
        const departmentIssues = fIssues.filter(issue => 
          issue.asset_id && departmentAssetIds.includes(issue.asset_id)
        );

        setAssets(fAssets);
        setTeamMembers(fTeamMembers);
        setIssues(departmentIssues);
      } catch (error) {
        console.error('Error fetching assets data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load department assets',
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
}, [user?.department_id]);

useEffect(() => {
  const loadAssetTypes = async () => {
    try {
      setLoadingAssetTypes(true);
      const data = await assetRequestTypeService.getAll();
      setAssetRequestTypes(data);
    } catch (error: any) {
      console.error('Failed to load asset request types:', error);
      addToast({
        title: 'Error',
        message: error?.response?.data?.error || 'Failed to load asset types',
        type: 'error',
        duration: 4000
      });
    } finally {
      setLoadingAssetTypes(false);
    }
  };
  loadAssetTypes();
}, [addToast]);

  useEffect(() => {
    if (!newAssetRequest.category && activeIssueCategories.length > 0) {
      setNewAssetRequest(prev => ({ ...prev, category: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, newAssetRequest.category]);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (asset.type && asset.type.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || asset.status === filterStatus;
    const matchesType = filterType === 'all' || asset.type === filterType;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
      case 'Assigned':
        return 'bg-green-100 text-green-800';
      case 'In Maintenance':
      case 'In Use':
        return 'bg-yellow-100 text-yellow-800';
      case 'Disposed':
      case 'Retired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Available':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'Assigned':
        return <UserIcon className="w-5 h-5 text-green-600" />;
      case 'In Maintenance':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      case 'In Use':
        return <MonitorIcon className="w-5 h-5 text-yellow-600" />;
      case 'Disposed':
      case 'Retired':
        return <ArchiveIcon className="w-5 h-5 text-red-600" />;
      default:
        return <MonitorIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const u = teamMembers.find(x => x.id === userId);
    return u ? u.name : 'Unknown';
  };

  const getAssetIssues = (assetId: string) => {
    return issues.filter(issue => issue.asset_id === assetId);
  };

  const getAssetImage = () => {
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <rect width="64" height="64" fill="#f3f4f6"/>
        <rect x="12" y="16" width="40" height="28" rx="4" fill="#9ca3af"/>
        <rect x="18" y="22" width="28" height="16" rx="2" fill="#e5e7eb"/>
        <rect x="24" y="48" width="16" height="4" rx="2" fill="#9ca3af"/>
      </svg>`
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewAsset = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowAssetModal(true);
  };

  const handleReportIssue = (asset: Asset) => {
    setNewIssue({
      title: '',
      description: '',
      priority: 'medium',
      asset_id: asset.id
    });
    setShowIssueModal(true);
  };

  const handleRequestAsset = () => {
    setNewAssetRequest({
      asset_name: '',
      asset_type: '',
      category: '',
      manufacturer: '',
      model: '',
      reason: '',
      priority: 'medium',
      requested_for: '',
      quantity: 1,
      notes: ''
    });
    setShowRequestModal(true);
  };

  const handleSubmitAssetRequest = async () => {
    if (!newAssetRequest.asset_name.trim() || !newAssetRequest.asset_type.trim() || !newAssetRequest.category.trim() || !newAssetRequest.reason.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all required fields (Asset Name, Type, Category, and Reason)',
        type: 'error',
        duration: 3000
      });
      return;
    }

    if (newAssetRequest.reason.trim().length < 10) {
      addToast({
        title: 'Validation Error',
        message: 'Reason must be at least 10 characters long',
        type: 'error',
        duration: 3000
      });
      return;
    }

    try {
      const requestData = {
        user_id: newAssetRequest.requested_for || user?.id, // Use selected user or current user
        asset_name: newAssetRequest.asset_name.trim(),
        asset_type: newAssetRequest.asset_type,
        category: newAssetRequest.category.trim(),
        reason: newAssetRequest.reason.trim(),
        priority: newAssetRequest.priority,
        notes: newAssetRequest.notes.trim() || null
      };

      await assetRequestsService.create(requestData);

      addToast({
        title: 'Asset Request Submitted',
        message: 'Your asset request has been submitted successfully',
        type: 'success',
        duration: 3000
      });

      setShowRequestModal(false);
      setNewAssetRequest({
        asset_name: '',
        asset_type: '',
        category: '',
        manufacturer: '',
        model: '',
        reason: '',
        priority: 'medium',
        requested_for: '',
        quantity: 1,
        notes: ''
      });
    } catch (error) {
      console.error('Error submitting asset request:', error);
      addToast({
        title: 'Error',
        message: 'Failed to submit asset request',
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleSubmitIssue = async () => {
    if (!newIssue.title.trim() || !newIssue.description.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all required fields',
        type: 'error',
        duration: 3000
      });
      return;
    }

    if (newIssue.title.trim().length < 5) {
      addToast({
        title: 'Validation Error',
        message: 'Issue title must be at least 5 characters long',
        type: 'error',
        duration: 3000
      });
      return;
    }

    if (newIssue.description.trim().length < 10) {
      addToast({
        title: 'Validation Error',
        message: 'Issue description must be at least 10 characters long',
        type: 'error',
        duration: 3000
      });
      return;
    }

    setSubmittingIssue(true);

    try {
      await issueService.create({
        title: newIssue.title.trim(),
        description: newIssue.description.trim(),
        priority: newIssue.priority,
        asset_id: newIssue.asset_id,
        category: 'Asset Issue' // Add category as required by backend
      });

      addToast({
        title: 'Issue Reported',
        message: 'Asset issue has been reported successfully',
        type: 'success',
        duration: 3000
      });

      setShowIssueModal(false);
      setNewIssue({ title: '', description: '', priority: 'medium', asset_id: '' });

      // Refresh issues
      const updatedIssues = await issueService.getAll();
      const departmentAssetIds = assets.map(asset => asset.id);
      const departmentIssues = updatedIssues.filter(issue => 
        issue.asset_id && departmentAssetIds.includes(issue.asset_id)
      );
      setIssues(departmentIssues);
    } catch (error) {
      console.error('Error reporting issue:', error);
      addToast({
        title: 'Error',
        message: 'Failed to report issue',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSubmittingIssue(false);
    }
  };

  const buildHtmlTable = (data: Asset[]) => {
    const headers = ['Name', 'Type', 'Serial Number', 'Status', 'Location', 'Assigned To', 'Purchase Date'];
    const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const thead = `<thead><tr>${headers.map(h => `<th style="text-align:left;border:1px solid #ccc;padding:6px;font-weight:bold;background:#f3f4f6;">${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${data.map(a => `<tr>${[
      a.name,
      a.type,
      a.serial_number,
      a.status,
      a.location || 'N/A',
      getUserName(a.assigned_to),
      a.purchase_date ? formatDate(a.purchase_date) : 'N/A'
    ].map(v => `<td style="border:1px solid #ccc;padding:6px;">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;">${thead}${tbody}</table>`;
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = filteredAssets;
      if (!data || data.length === 0) {
        addToast({ title: 'No Data', message: 'No assets match the current filters to export.', type: 'warning', duration: 3000 });
        setIsExporting(false);
        return;
      }

      if (exportFormat === 'csv') {
        const headers = ['Name', 'Type', 'Serial Number', 'Status', 'Location', 'Assigned To', 'Purchase Date'];
        const csvRows: string[] = [];
        csvRows.push(headers.join(','));
        
        for (const a of data) {
          const row = [
            a.name || '',
            a.type || '',
            a.serial_number || '',
            a.status || '',
            a.location || '',
            getUserName(a.assigned_to),
            a.purchase_date ? formatDate(a.purchase_date) : 'N/A'
          ].map(v => {
            const s = String(v).replace(/[\r\n]+/g, ' ').trim();
            return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
          }).join(',');
          csvRows.push(row);
        }
        
        const BOM = '\uFEFF';
        const csvContent = BOM + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentAssets_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        const exportData = data.map(a => ({
          name: a.name,
          type: a.type,
          serial_number: a.serial_number,
          status: a.status,
          location: a.location || '',
          assigned_to: getUserName(a.assigned_to),
          purchase_date: a.purchase_date ? formatDate(a.purchase_date) : 'N/A'
        }));
        
        const jsonContent = JSON.stringify({
          exported_at: new Date().toISOString(),
          total_records: exportData.length,
          data: exportData
        }, null, 2);
        
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentAssets_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'txt') {
        const headers = ['Name', 'Type', 'Serial', 'Status', 'Location', 'Assigned To', 'Purchase Date'];
        const rows = data.map(a => [
          a.name || '',
          a.type || '',
          a.serial_number || '',
          a.status || '',
          a.location || '',
          getUserName(a.assigned_to),
          a.purchase_date ? formatDate(a.purchase_date) : 'N/A'
        ]);
        
        const colWidths = headers.map((h, i) => {
          const maxDataWidth = Math.max(...rows.map(r => String(r[i] || '').length));
          return Math.max(h.length, maxDataWidth, 8);
        });
        
        const separator = colWidths.map(w => '='.repeat(w)).join('  ');
        const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
        const dataRows = rows.map(row => 
          row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('  ')
        );
        
        const textContent = [
          'DEPARTMENT ASSETS EXPORT',
          `Exported: ${new Date().toLocaleString()}`,
          `Total Assets: ${data.length}`,
          '',
          headerRow,
          separator,
          ...dataRows
        ].join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentAssets_${new Date().toISOString().slice(0, 10)}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'excel') {
        const headers = ['Name', 'Type', 'Serial Number', 'Status', 'Location', 'Assigned To', 'Purchase Date'];
        const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const thead = `<thead><tr style="background-color: #2563eb; color: white; font-weight: bold;">${headers.map(h => 
          `<th style="text-align:left; border:1px solid #ccc; padding:12px; font-size:14px;">${h}</th>`
        ).join('')}</tr></thead>`;
        
        const tbody = `<tbody>${data.map((a, idx) => {
          const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
          return `<tr style="background-color: ${bgColor};">${[
            a.name,
            a.type,
            a.serial_number,
            a.status,
            a.location || '',
            getUserName(a.assigned_to),
            a.purchase_date ? formatDate(a.purchase_date) : 'N/A'
          ].map(v => `<td style="border:1px solid #ccc; padding:10px; font-size:12px;">${escapeHtml(v)}</td>`).join('')}</tr>`;
        }).join('')}</tbody>`;
        
        const table = `<table style="border-collapse:collapse; width:100%; font-family:Arial, sans-serif;">${thead}${tbody}</table>`;
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #2563eb; margin-bottom: 10px; }
    .info { color: #666; margin-bottom: 20px; font-size: 14px; }
  </style>
</head>
<body>
  <h1>Department Assets Export</h1>
  <div class="info">
    <div>Exported: ${new Date().toLocaleString()}</div>
    <div>Total Assets: ${data.length}</div>
  </div>
  ${table}
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentAssets_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'pdf') {
        const ensureJsPdf = () => new Promise<void>((resolve, reject) => {
          if ((window as any).jspdf?.jsPDF) return resolve();
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load jsPDF'));
          document.head.appendChild(s);
        });
        
        await ensureJsPdf();
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        let y = margin;
        
        const logoDataUrl: string = await new Promise(resolve => {
          try {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0);
                  resolve(canvas.toDataURL('image/png'));
                } else {
                  resolve('');
                }
              } catch {
                resolve('');
              }
            };
            img.onerror = () => resolve('');
            img.src = Logo as unknown as string;
          } catch {
            resolve('');
          }
        });
        
        if (logoDataUrl) {
          try {
            doc.addImage(logoDataUrl, 'PNG', margin, y, 100, 40);
          } catch (e) {
            console.error('Failed to add logo:', e);
          }
        }
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const now = new Date();
        const dateStr = `Exported: ${now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}, ${now.toLocaleTimeString('en-US')}`;
        doc.text(dateStr, pageWidth - margin - 140, y + 20, { align: 'left' });
        
        y += 60;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Department Assets Export', margin, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total assets: ${data.length}`, margin, y);
        y += 25;
        
        const headers = ['Name', 'Type', 'Serial', 'Status', 'Location', 'Assigned'];
        const colWidths = [100, 70, 80, 70, 80, 100];
        const rowHeight = 20;
        const cellPadding = 5;
        
        const drawRow = (cells: string[], isHeader: boolean = false, startY: number) => {
          let x = margin;
          const rowY = startY;
          doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          doc.setFontSize(isHeader ? 9 : 8);
          
          for (let i = 0; i < cells.length; i++) {
            const cellWidth = colWidths[i];
            const cellText = String(cells[i] ?? '');
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.rect(x, rowY, cellWidth, rowHeight);
            
            if (isHeader) {
              doc.setFillColor(243, 244, 246);
              doc.rect(x, rowY, cellWidth, rowHeight, 'F');
              doc.rect(x, rowY, cellWidth, rowHeight);
            }
            
            const maxWidth = cellWidth - (cellPadding * 2);
            const lines = doc.splitTextToSize(cellText, maxWidth) as string[];
            const textY = rowY + (rowHeight / 2) + (lines.length > 1 ? 3 : 5);
            doc.text(lines[0] || '', x + cellPadding, textY);
            x += cellWidth;
          }
          return rowY + rowHeight;
        };
        
        y = drawRow(headers, true, y);
        
        for (const a of data) {
          if (y + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            y = drawRow(headers, true, y);
          }
          
          const cells = [
            a.name,
            a.type,
            a.serial_number,
            a.status,
            a.location || 'N/A',
            getUserName(a.assigned_to)
          ];
          y = drawRow(cells, false, y);
        }
        
        doc.save(`DepartmentAssets_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      addToast({ title: 'Export Complete', message: 'Assets exported successfully.', type: 'success', duration: 3000 });
    } catch (e: any) {
      console.error('Export error:', e);
      addToast({ title: 'Export Failed', message: e?.message || 'Could not export assets.', type: 'error', duration: 5000 });
    } finally {
      setIsExporting(false);
    }
  };

  const assetStats = {
    total: assets.length,
    available: assets.filter(a => a.status === 'Available').length,
    assigned: assets.filter(a => a.status === 'Assigned').length,
    maintenance: assets.filter(a => a.status === 'In Maintenance').length,
    disposed: assets.filter(a => a.status === 'Disposed' || a.status === 'Retired').length
  };

  const assetTypes = [...new Set(assets.map(asset => asset.type).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading department assets...</p>
        </div>
      </div>
    );
  }

  if (!user?.department_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BuildingIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No Department Assigned</h2>
          <p className="text-gray-500 dark:text-gray-400">Please contact your administrator to assign you to a department.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Department Assets</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              View and manage assets assigned to your department
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleRequestAsset}
              className="px-6 py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 flex items-center font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Request New Asset
            </button>
            <select 
              value={exportFormat} 
              onChange={e => setExportFormat(e.target.value as any)} 
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl"
            >
              <option value="csv">CSV</option>
              <option value="excel">Excel (.xls)</option>
              <option value="json">JSON</option>
              <option value="txt">Text (.txt)</option>
              <option value="pdf">PDF</option>
            </select>
            <button 
              onClick={handleExport}
              disabled={isExporting || filteredAssets.length === 0}
              className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 disabled:opacity-50 flex items-center"
            >
              <DownloadIcon className="w-4 h-4 mr-2" /> 
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <MonitorIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{assetStats.total}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-green-100 rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Available</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{assetStats.available}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Assigned</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{assetStats.assigned}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Maintenance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{assetStats.maintenance}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <ArchiveIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Disposed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{assetStats.disposed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-card">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Status</option>
              <option value="Available">Available</option>
              <option value="Assigned">Assigned</option>
              <option value="In Maintenance">In Maintenance</option>
              <option value="In Use">In Use</option>
              <option value="Disposed">Disposed</option>
              <option value="Retired">Retired</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Types</option>
              {assetTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Assets ({filteredAssets.length})</h2>
        
        {filteredAssets.length === 0 ? (
          <div className="text-center py-12">
            <MonitorIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No assets found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssets.map((asset) => {
              const assetIssues = getAssetIssues(asset.id);
              const openIssues = assetIssues.filter(issue => issue.status === 'Open');
              
              return (
                <div key={asset.id} className="p-6 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <img 
                        src={getAssetImage()} 
                        alt={asset.name} 
                        className="w-12 h-12 rounded-lg object-cover mr-4" 
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{asset.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{asset.type}</p>
                      </div>
                    </div>
                    <div className={`p-2 rounded-full ${asset.status === 'Available' ? 'bg-green-100' : asset.status === 'Assigned' ? 'bg-blue-100' : asset.status === 'In Maintenance' ? 'bg-yellow-100' : 'bg-red-100'}`}>
                      {getStatusIcon(asset.status)}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      <p><strong>Serial:</strong> {asset.serial_number}</p>
                      <p><strong>Assigned to:</strong> {getUserName(asset.assigned_to)}</p>
                      <p><strong>Location:</strong> {asset.location || 'Not specified'}</p>
                    </div>

                    {asset.purchase_date && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        <CalendarIcon className="w-4 h-4 mr-1 inline" />
                        Purchased: {formatDate(asset.purchase_date)}
                      </div>
                    )}

                    {openIssues.length > 0 && (
                      <div className="flex items-center text-sm text-red-600 dark:text-red-400">
                        <AlertCircleIcon className="w-4 h-4 mr-1" />
                        <span>{openIssues.length} open issue{openIssues.length > 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(asset.status)}`}>
                        {asset.status}
                      </span>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        #{asset.id.slice(-8)}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <button
                      onClick={() => handleViewAsset(asset)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                    >
                      <EyeIcon className="w-4 h-4 mr-1 inline" />
                      View
                    </button>
                    <button
                      onClick={() => handleReportIssue(asset)}
                      className="flex-1 px-3 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <AlertCircleIcon className="w-4 h-4 mr-1 inline" />
                      Report Issue
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Asset Details Modal */}
      {showAssetModal && selectedAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Asset Details</h3>
              <button
                onClick={() => setShowAssetModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Asset Header */}
              <div className="flex items-start gap-4">
                <img 
                  src={getAssetImage()} 
                  alt={selectedAsset.name} 
                  className="w-20 h-20 rounded-lg object-cover" 
                />
                <div className="flex-1">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{selectedAsset.name}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>{selectedAsset.type}</span>
                    <span>•</span>
                    <span>SN: {selectedAsset.serial_number}</span>
                    <span>•</span>
                    <span>Assigned to: {getUserName(selectedAsset.assigned_to)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedAsset.status)}`}>
                    {selectedAsset.status}
                  </span>
                </div>
              </div>

              {/* Asset Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Basic Information</h5>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Name:</strong> {selectedAsset.name}</p>
                    <p><strong>Type:</strong> {selectedAsset.type}</p>
                    <p><strong>Serial Number:</strong> {selectedAsset.serial_number}</p>
                    <p><strong>Status:</strong> {selectedAsset.status}</p>
                    <p><strong>Location:</strong> {selectedAsset.location || 'Not specified'}</p>
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Assignment</h5>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <p><strong>Assigned to:</strong> {getUserName(selectedAsset.assigned_to)}</p>
                    <p><strong>Purchase Date:</strong> {selectedAsset.purchase_date ? formatDate(selectedAsset.purchase_date) : 'Not specified'}</p>
                    <p><strong>Warranty:</strong> {selectedAsset.warranty_expiry ? formatDate(selectedAsset.warranty_expiry) : 'Not specified'}</p>
                  </div>
                </div>
              </div>

              {/* Asset Issues */}
              {getAssetIssues(selectedAsset.id).length > 0 && (
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Related Issues ({getAssetIssues(selectedAsset.id).length})</h5>
                  <div className="space-y-2">
                    {getAssetIssues(selectedAsset.id).slice(0, 3).map((issue) => (
                      <div key={issue.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{issue.title}</span>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${issue.status === 'Open' ? 'bg-red-100 text-red-800' : issue.status === 'In Progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                            {issue.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{issue.description}</p>
                      </div>
                    ))}
                    {getAssetIssues(selectedAsset.id).length > 3 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        +{getAssetIssues(selectedAsset.id).length - 3} more issues
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => handleReportIssue(selectedAsset)}
                  className="flex-1 px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                >
                  <AlertCircleIcon className="w-4 h-4 mr-2 inline" />
                  Report Issue
                </button>
                <button
                  onClick={() => setShowAssetModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showIssueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Report Asset Issue</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Issue Title *
                </label>
                <input
                  type="text"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Brief description of the issue (min 5 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  rows={4}
                  placeholder="Detailed description of the issue (min 10 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newIssue.priority}
                  onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmitIssue}
                  disabled={submittingIssue}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg flex items-center justify-center"
                >
                  {submittingIssue ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Submitting Issue...
                    </>
                  ) : (
                    'Report Issue'
                  )}
                </button>
                <button
                  onClick={() => setShowIssueModal(false)}
                  disabled={submittingIssue}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Asset Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Request New Asset</h2>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Asset Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Asset Name *
                  </label>
                  <input
                    type="text"
                    value={newAssetRequest.asset_name}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, asset_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., Dell Laptop XPS 13"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Asset Type *
                  </label>
                  <select
                    value={newAssetRequest.asset_type}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, asset_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={loadingAssetTypes || (activeAssetTypes.length === 0 && !newAssetRequest.asset_type)}
                  >
                    <option value="">
                      {loadingAssetTypes
                        ? 'Loading asset types...'
                        : activeAssetTypes.length
                          ? 'Select Asset Type'
                          : 'No active asset types available'}
                    </option>
                    {activeAssetTypes.map((type) => (
                      <option key={type.id} value={type.name}>
                        {type.name}
                      </option>
                    ))}
                    {!loadingAssetTypes && newAssetRequest.asset_type && !assetRequestTypes.some(type => type.name === newAssetRequest.asset_type) && (
                      <option value={newAssetRequest.asset_type}>{newAssetRequest.asset_type}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={newAssetRequest.category}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                    disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !newAssetRequest.category)}
                  >
                    <option value="">
                      {loadingIssueCategories
                        ? 'Loading categories...'
                        : activeIssueCategories.length
                          ? 'Select Category'
                          : 'No active categories available'}
                    </option>
                    {activeIssueCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                    {!loadingIssueCategories && newAssetRequest.category && !issueCategories.some(category => category.name === newAssetRequest.category) && (
                      <option value={newAssetRequest.category}>{newAssetRequest.category}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={newAssetRequest.manufacturer}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, manufacturer: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., Dell, HP, Apple"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Model
                  </label>
                  <input
                    type="text"
                    value={newAssetRequest.model}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., XPS 13, MacBook Pro"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newAssetRequest.quantity}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Requested For
                  </label>
                  <select
                    value={newAssetRequest.requested_for}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, requested_for: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">Select Team Member</option>
                    {teamMembers.map(member => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Request *
                  </label>
                  <textarea
                    value={newAssetRequest.reason}
                    onChange={(e) => setNewAssetRequest({ ...newAssetRequest, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows={3}
                    placeholder="Explain why this asset is needed (minimum 10 characters)..."
                    required
                  />
                </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={newAssetRequest.notes}
                  onChange={(e) => setNewAssetRequest({ ...newAssetRequest, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                  rows={2}
                  placeholder="Any additional information or specifications..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newAssetRequest.priority}
                  onChange={(e) => setNewAssetRequest({ ...newAssetRequest, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAssetRequest}
                  className="px-6 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentAssets;
