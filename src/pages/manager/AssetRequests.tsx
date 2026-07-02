import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import {
  TicketIcon,
  SearchIcon,
  FilterIcon,
  EyeIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  PlusIcon,
  TrendingUpIcon,
  CalendarIcon,
  UserIcon,
  MessageSquareIcon,
  AlertCircleIcon,
  DownloadIcon
} from 'lucide-react';
import Logo from '../../assets/logo.png';
import AssetImage from '../../components/AssetImage';
import { assetRequestsService, userService, managerService, assetRequestTypeService } from '../../services/apiDatabase';
import { AssetRequest, User, AssetRequestType } from '../../lib/supabase';
import useIssueCategories from '../../hooks/useIssueCategories';

const AssetRequests: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AssetRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [newRequest, setNewRequest] = useState({
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
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedRequestForFollowUp, setSelectedRequestForFollowUp] = useState<AssetRequest | null>(null);
  const [followUpNote, setFollowUpNote] = useState('');
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
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
        const [fTeamMembers, fRequests] = await Promise.all([
          managerService.getTeamMembers(),
          managerService.getDepartmentAssetRequests()
        ]);

        setTeamMembers(fTeamMembers);
        setRequests(fRequests);

        // Debug: Log the requests to see what data we're getting
        // console.log('Updated requests:', fRequests);
      } catch (error) {
        console.error('Error fetching requests data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load asset requests',
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
    if (!newRequest.category && activeIssueCategories.length > 0) {
      setNewRequest(prev => ({ ...prev, category: activeIssueCategories[0].name }));
    }
  }, [activeIssueCategories, newRequest.category]);

  const filteredRequests = requests.filter(request => {
    const matchesSearch = request.asset_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.justification.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || request.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      case 'In Progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-100 text-red-800';
      case 'Medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'Low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      case 'Pending':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      case 'Rejected':
        return <XCircleIcon className="w-5 h-5 text-red-600" />;
      case 'In Progress':
        return <TrendingUpIcon className="w-5 h-5 text-blue-600" />;
      default:
        return <TicketIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getUserName = (userId: string | null, userName?: string) => {
    if (userName) return userName;
    if (!userId) return 'Unknown';
    const u = teamMembers.find(x => x.id === userId);
    return u ? u.name : 'Unknown';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewRequest = (request: AssetRequest) => {
    setSelectedRequest(request);
    setShowRequestModal(true);
  };

  const handleNewRequest = () => {
    setNewRequest({
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
    setShowNewRequestModal(true);
  };

  const handleSubmitNewRequest = async () => {
    if (!newRequest.asset_name.trim() || !newRequest.asset_type.trim() || !newRequest.category.trim() || !newRequest.reason.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please fill in all required fields (Asset Name, Type, Category, and Reason)',
        type: 'error',
        duration: 3000
      });
      return;
    }

    if (newRequest.reason.trim().length < 10) {
      addToast({
        title: 'Validation Error',
        message: 'Reason must be at least 10 characters long',
        type: 'error',
        duration: 3000
      });
      return;
    }

    setSubmittingRequest(true);

    try {
      const requestData = {
        user_id: newRequest.requested_for || user?.id, // Use selected user or current user
        asset_name: newRequest.asset_name.trim(),
        asset_type: newRequest.asset_type,
        category: newRequest.category.trim(),
        reason: newRequest.reason.trim(),
        priority: newRequest.priority,
        notes: newRequest.notes.trim() || null
      };

      await assetRequestsService.create(requestData);

      addToast({
        title: 'Asset Request Submitted',
        message: 'Your asset request has been submitted successfully',
        type: 'success',
        duration: 3000
      });

      setShowNewRequestModal(false);
      setNewRequest({
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

      // Refresh requests
      const [fTeamMembers, fRequests] = await Promise.all([
        managerService.getTeamMembers(),
        managerService.getDepartmentAssetRequests()
      ]);
      setTeamMembers(fTeamMembers);
      setRequests(fRequests);
    } catch (error) {
      console.error('Error submitting asset request:', error);
      addToast({
        title: 'Error',
        message: 'Failed to submit asset request',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleFollowUp = (request: AssetRequest) => {
    setSelectedRequestForFollowUp(request);
    setFollowUpNote('');
    setShowFollowUpModal(true);
  };

  const handleSubmitFollowUp = async () => {
    if (!selectedRequestForFollowUp || !followUpNote.trim()) {
      addToast({
        title: 'Validation Error',
        message: 'Please enter a follow-up note',
        type: 'error',
        duration: 3000
      });
      return;
    }

    setSubmittingFollowUp(true);
    try {
      // Add follow-up note to the request
      await assetRequestsService.update(selectedRequestForFollowUp.id, {
        notes: followUpNote.trim()
      });

      addToast({
        title: 'Follow-up Added',
        message: 'Follow-up note has been added for admin review',
        type: 'success',
        duration: 3000
      });

      setShowFollowUpModal(false);
      setSelectedRequestForFollowUp(null);
      setFollowUpNote('');

      // Refresh requests
      const updatedRequests = await managerService.getDepartmentAssetRequests();
      setRequests(updatedRequests);
    } catch (error) {
      console.error('Error adding follow-up:', error);
      addToast({
        title: 'Error',
        message: 'Failed to add follow-up note',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  const handleApproveRequest = async (request: AssetRequest) => {
    try {
      await assetRequestsService.update(request.id, {
        status: 'Approved',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      });

      // Refresh requests
      const updatedRequests = await assetRequestsService.getAll();
      const departmentMemberIds = teamMembers.map(member => member.id);
      const departmentRequests = updatedRequests.filter(req =>
        departmentMemberIds.includes(req.requested_by)
      );
      setRequests(departmentRequests);

      addToast({
        title: 'Request Approved',
        message: 'Asset request has been approved successfully',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error approving request:', error);
      addToast({
        title: 'Error',
        message: 'Failed to approve request',
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleRejectRequest = async (request: AssetRequest) => {
    try {
      await assetRequestsService.update(request.id, {
        status: 'Rejected',
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      });

      // Refresh requests
      const updatedRequests = await assetRequestsService.getAll();
      const departmentMemberIds = teamMembers.map(member => member.id);
      const departmentRequests = updatedRequests.filter(req =>
        departmentMemberIds.includes(req.requested_by)
      );
      setRequests(departmentRequests);

      addToast({
        title: 'Request Rejected',
        message: 'Asset request has been rejected',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      addToast({
        title: 'Error',
        message: 'Failed to reject request',
        type: 'error',
        duration: 5000
      });
    }
  };

  const buildHtmlTable = (data: AssetRequest[]) => {
    const headers = ['Asset Type', 'Status', 'Priority', 'Requested By', 'Description', 'Created At'];
    const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const thead = `<thead><tr>${headers.map(h => `<th style="text-align:left;border:1px solid #ccc;padding:6px;font-weight:bold;background:#f3f4f6;">${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${data.map(r => `<tr>${[
      (r as any).asset_name || r.asset_type,
      r.status,
      r.priority || 'N/A',
      getUserName((r as any).user_id || r.user_id, (r as any).user_name),
      (r as any).reason || r.description || 'N/A',
      formatDate((r as any).created_at || r.created_at)
    ].map(v => `<td style="border:1px solid #ccc;padding:6px;">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;">${thead}${tbody}</table>`;
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = filteredRequests;
      if (!data || data.length === 0) {
        addToast({ title: 'No Data', message: 'No requests match the current filters to export.', type: 'warning', duration: 3000 });
        setIsExporting(false);
        return;
      }

      if (exportFormat === 'csv') {
        const headers = ['Asset Name', 'Status', 'Priority', 'Requested By', 'Category', 'Reason', 'Created At'];
        const csvRows: string[] = [];
        csvRows.push(headers.join(','));

        for (const r of data) {
          const row = [
            (r as any).asset_name || r.asset_type || '',
            r.status || '',
            r.priority || '',
            getUserName((r as any).user_id || r.user_id, (r as any).user_name),
            r.category || '',
            ((r as any).reason || '').replace(/[\r\n]+/g, ' '),
            formatDate((r as any).created_at || r.created_at)
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
        link.setAttribute('download', `AssetRequests_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        const exportData = data.map(r => ({
          asset_name: (r as any).asset_name || r.asset_type || '',
          status: r.status,
          priority: r.priority || '',
          requested_by: getUserName((r as any).user_id || r.user_id, (r as any).user_name),
          category: r.category || '',
          reason: (r as any).reason || '',
          created_at: formatDate((r as any).created_at || r.created_at)
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
        link.setAttribute('download', `AssetRequests_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'txt') {
        const headers = ['Asset', 'Status', 'Priority', 'Requested By', 'Category', 'Created At'];
        const rows = data.map(r => [
          (r as any).asset_name || r.asset_type || '',
          r.status || '',
          r.priority || '',
          getUserName((r as any).user_id || r.user_id, (r as any).user_name),
          r.category || '',
          formatDate((r as any).created_at || r.created_at)
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
          'ASSET REQUESTS EXPORT',
          `Exported: ${new Date().toLocaleString()}`,
          `Total Requests: ${data.length}`,
          '',
          headerRow,
          separator,
          ...dataRows
        ].join('\n');

        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `AssetRequests_${new Date().toISOString().slice(0, 10)}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'excel') {
        const headers = ['Asset Name', 'Status', 'Priority', 'Requested By', 'Category', 'Reason', 'Created At'];
        const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const thead = `<thead><tr style="background-color: #2563eb; color: white; font-weight: bold;">${headers.map(h =>
          `<th style="text-align:left; border:1px solid #ccc; padding:12px; font-size:14px;">${h}</th>`
        ).join('')}</tr></thead>`;

        const tbody = `<tbody>${data.map((r, idx) => {
          const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
          return `<tr style="background-color: ${bgColor};">${[
            (r as any).asset_name || r.asset_type || '',
            r.status,
            r.priority || '',
            getUserName((r as any).user_id || r.user_id, (r as any).user_name),
            r.category || '',
            ((r as any).reason || '').substring(0, 100),
            formatDate((r as any).created_at || r.created_at)
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
  <h1>Asset Requests Export</h1>
  <div class="info">
    <div>Exported: ${new Date().toLocaleString()}</div>
    <div>Total Requests: ${data.length}</div>
  </div>
  ${table}
</body>
</html>`;

        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `AssetRequests_${new Date().toISOString().slice(0, 10)}.xls`);
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
        doc.text('Asset Requests Export', margin, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total requests: ${data.length}`, margin, y);
        y += 25;

        const headers = ['Asset', 'Status', 'Priority', 'Requested By', 'Created'];
        const colWidths = [140, 80, 70, 120, 90];
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

        for (const r of data) {
          if (y + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            y = drawRow(headers, true, y);
          }

          const cells = [
            (r as any).asset_name || r.asset_type,
            r.status,
            r.priority || 'N/A',
            getUserName((r as any).user_id || r.user_id, (r as any).user_name),
            formatDate((r as any).created_at || r.created_at)
          ];
          y = drawRow(cells, false, y);
        }

        doc.save(`AssetRequests_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      addToast({ title: 'Export Complete', message: 'Requests exported successfully.', type: 'success', duration: 3000 });
    } catch (e: any) {
      console.error('Export error:', e);
      addToast({ title: 'Export Failed', message: e?.message || 'Could not export requests.', type: 'error', duration: 5000 });
    } finally {
      setIsExporting(false);
    }
  };


  const requestStats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
    inProgress: requests.filter(r => r.status === 'In Progress').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading asset requests...</p>
        </div>
      </div>
    );
  }

  if (!user?.department_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <TicketIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
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
            <h1 className="text-3xl font-bold text-primary">Asset Requests</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Manage asset requests from your team members
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleNewRequest}
              className="px-6 py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 flex items-center font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              New Request
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
              disabled={isExporting || filteredRequests.length === 0}
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
              <TicketIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requestStats.total}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Pending</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requestStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-green-100 rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Approved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requestStats.approved}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <XCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Rejected</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requestStats.rejected}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <TrendingUpIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">In Progress</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{requestStats.inProgress}</p>
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
              placeholder="Search requests..."
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
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="In Progress">In Progress</option>
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Requests ({filteredRequests.length})</h2>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <TicketIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No requests found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <div key={request.id} className="p-6 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        <AssetImage
                          assetType={assetRequestTypes.find(t => t.name === request.asset_type)}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className={`p-2 rounded-full ${request.status === 'Approved' ? 'bg-green-100' : request.status === 'Pending' ? 'bg-yellow-100' : request.status === 'Rejected' ? 'bg-red-100' : 'bg-blue-100'}`}>
                        {getStatusIcon(request.status)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {(() => {
                          const assetName = (request as any).asset_name || request.asset_type || 'Unnamed Asset';
                          return assetName.startsWith('Request for ') ? assetName : `Request for ${assetName}`;
                        })()}
                      </h3>
                    </div>

                    <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {(request as any).reason || request.description || 'No description provided'}
                    </p>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <UserIcon className="w-4 h-4 mr-1" />
                        <span>Requested by {getUserName((request as any).user_id || request.user_id, (request as any).user_name)}</span>
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        <span>{formatDate((request as any).created_at || request.created_at)}</span>
                      </div>
                      {request.priority && (
                        <div className="flex items-center">
                          <AlertCircleIcon className="w-4 h-4 mr-1" />
                          <span>Priority: {request.priority}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                    {request.priority && (
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(request.priority)}`}>
                        {request.priority}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewRequest(request)}
                      className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                    >
                      <EyeIcon className="w-4 h-4 mr-1 inline" />
                      View Details
                    </button>
                    <button
                      onClick={() => handleFollowUp(request)}
                      className="px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Follow-up
                    </button>
                    {request.status === 'Pending' && (
                      <>
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="px-4 py-2 text-sm font-medium text-green-600 border border-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-1 inline" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request)}
                          className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                        >
                          <XCircleIcon className="w-4 h-4 mr-1 inline" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>

                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Request #{request.id.slice(-8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Details Modal */}
      {showRequestModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Request Details</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Request Header */}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${selectedRequest.status === 'Approved' ? 'bg-green-100' : selectedRequest.status === 'Pending' ? 'bg-yellow-100' : selectedRequest.status === 'Rejected' ? 'bg-red-100' : 'bg-blue-100'}`}>
                  {getStatusIcon(selectedRequest.status)}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{(selectedRequest as any).asset_name || selectedRequest.asset_type}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Requested by {getUserName(selectedRequest.user_id, (selectedRequest as any).user_name)}</span>
                    <span>•</span>
                    <span>{formatDate((selectedRequest as any).created_at)}</span>
                    {selectedRequest.priority && (
                      <>
                        <span>•</span>
                        <span>Priority: {selectedRequest.priority}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedRequest.status)}`}>
                    {selectedRequest.status}
                  </span>
                  {selectedRequest.priority && (
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(selectedRequest.priority)}`}>
                      {selectedRequest.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Request Details */}
              <div className="space-y-4">
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h5>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{(selectedRequest as any).reason || selectedRequest.description}</p>
                </div>

                {selectedRequest.justification && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Justification</h5>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selectedRequest.justification}</p>
                  </div>
                )}

                {selectedRequest.approved_by && (
                  <div>
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Approval Details</h5>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <p><strong>Approved by:</strong> {getUserName(selectedRequest.approved_by, (selectedRequest as any).approved_by_name)}</p>
                      {selectedRequest.approved_at && (
                        <p><strong>Approved at:</strong> {formatDate(selectedRequest.approved_at)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                {selectedRequest.status === 'Pending' && (
                  <>
                    <button
                      onClick={() => handleApproveRequest(selectedRequest)}
                      className="flex-1 px-4 py-2 text-green-600 border border-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-colors"
                    >
                      <CheckCircleIcon className="w-4 h-4 mr-2 inline" />
                      Approve Request
                    </button>
                    <button
                      onClick={() => handleRejectRequest(selectedRequest)}
                      className="flex-1 px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <XCircleIcon className="w-4 h-4 mr-2 inline" />
                      Reject Request
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">New Asset Request</h3>
              <button
                onClick={() => setShowNewRequestModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Asset Type *
                </label>
                <select
                  value={newRequest.asset_type}
                  onChange={(e) => setNewRequest({ ...newRequest, asset_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  disabled={loadingAssetTypes || (activeAssetTypes.length === 0 && !newRequest.asset_type)}
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
                  {!loadingAssetTypes && newRequest.asset_type && !assetRequestTypes.some(type => type.name === newRequest.asset_type) && (
                    <option value={newRequest.asset_type}>{newRequest.asset_type}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={newRequest.description}
                  onChange={(e) => setNewRequest({ ...newRequest, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Describe the asset you need"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Justification
                </label>
                <textarea
                  value={newRequest.justification}
                  onChange={(e) => setNewRequest({ ...newRequest, justification: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  rows={3}
                  placeholder="Explain why this asset is needed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Priority
                </label>
                <select
                  value={newRequest.priority}
                  onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSubmitNewRequest}
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Submit Request
                </button>
                <button
                  onClick={() => setShowNewRequestModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Request New Asset</h2>
              <button
                onClick={() => setShowNewRequestModal(false)}
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
                    value={newRequest.asset_name}
                    onChange={(e) => setNewRequest({ ...newRequest, asset_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="e.g., Dell Laptop XPS 13"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Asset Type *
                  </label>
                  <select
                    value={newRequest.asset_type}
                    onChange={(e) => setNewRequest({ ...newRequest, asset_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    disabled={loadingAssetTypes || (activeAssetTypes.length === 0 && !newRequest.asset_type)}
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
                    {!loadingAssetTypes && newRequest.asset_type && !assetRequestTypes.some(type => type.name === newRequest.asset_type) && (
                      <option value={newRequest.asset_type}>{newRequest.asset_type}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Category *
                  </label>
                  <select
                    value={newRequest.category}
                    onChange={(e) => setNewRequest({ ...newRequest, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    required
                    disabled={loadingIssueCategories || (activeIssueCategories.length === 0 && !newRequest.category)}
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
                    {!loadingIssueCategories && newRequest.category && !issueCategories.some(category => category.name === newRequest.category) && (
                      <option value={newRequest.category}>{newRequest.category}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    value={newRequest.manufacturer}
                    onChange={(e) => setNewRequest({ ...newRequest, manufacturer: e.target.value })}
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
                    value={newRequest.model}
                    onChange={(e) => setNewRequest({ ...newRequest, model: e.target.value })}
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
                    value={newRequest.quantity}
                    onChange={(e) => setNewRequest({ ...newRequest, quantity: parseInt(e.target.value) || 1 })}
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
                    value={newRequest.requested_for}
                    onChange={(e) => setNewRequest({ ...newRequest, requested_for: e.target.value })}
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
                    value={newRequest.reason}
                    onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
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
                    value={newRequest.notes}
                    onChange={(e) => setNewRequest({ ...newRequest, notes: e.target.value })}
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
                    value={newRequest.priority}
                    onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
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
                  onClick={() => setShowNewRequestModal(false)}
                  disabled={submittingRequest}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitNewRequest}
                  disabled={submittingRequest}
                  className="px-6 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {submittingRequest ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Submitting Request...
                    </>
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {showFollowUpModal && selectedRequestForFollowUp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Follow-up Note</h2>
              <button
                onClick={() => setShowFollowUpModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {(selectedRequestForFollowUp as any).asset_name || selectedRequestForFollowUp.asset_type}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Requested by {getUserName(selectedRequestForFollowUp.user_id, (selectedRequestForFollowUp as any).user_name)}
                </p>
              </div>

              <div className="space-y-4">
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>Note:</strong> This follow-up will be visible to admins and other managers for tracking request progress and communication.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Follow-up Note *
                  </label>
                  <textarea
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
                    rows={4}
                    placeholder="Add a follow-up note for admin review (e.g., progress update, additional requirements, priority changes)..."
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => setShowFollowUpModal(false)}
                    disabled={submittingFollowUp}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitFollowUp}
                    disabled={submittingFollowUp}
                    className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {submittingFollowUp ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Adding Follow-up...
                      </>
                    ) : (
                      'Add Follow-up'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetRequests;
