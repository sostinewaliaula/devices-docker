import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  AlertCircleIcon, 
  SearchIcon, 
  FilterIcon, 
  ClockIcon, 
  CheckCircleIcon, 
  ArchiveIcon,
  EyeIcon,
  MessageSquareIcon,
  PlusIcon,
  TrendingUpIcon,
  CalendarIcon,
  UserIcon,
  MonitorIcon,
  DownloadIcon
} from 'lucide-react';
import Logo from '../../assets/logo.png';
import { issueService, assetService, userService, commentService } from '../../services/apiDatabase';
import { Issue, Asset, User, IssueComment } from '../../lib/supabase';

const DepartmentIssues: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [comments, setComments] = useState<IssueComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [editingComment, setEditingComment] = useState<IssueComment | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [newIssue, setNewIssue] = useState({
    title: '',
    description: '',
    priority: 'medium',
    asset_id: ''
  });

  useEffect(() => {
    if (!user?.department_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fIssues, fAssets, fTeamMembers] = await Promise.all([
          issueService.getAll(),
          assetService.getByDepartment(user.department_id!),
          userService.getByDepartment(user.department_id!)
        ]);

        // Filter issues for department members and assets
        const departmentMemberIds = fTeamMembers.map(member => member.id);
        const departmentAssetIds = fAssets.map(asset => asset.id);
        
        const departmentIssues = fIssues.filter(issue => 
          departmentMemberIds.includes(issue.reported_by) || 
          (issue.asset_id && departmentAssetIds.includes(issue.asset_id))
        );

        setIssues(departmentIssues);
        setAssets(fAssets);
        setTeamMembers(fTeamMembers);
      } catch (error) {
        console.error('Error fetching issues data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load department issues',
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
    if (selectedIssue) {
      const fetchComments = async () => {
        try {
          const issueComments = await commentService.getByIssueId(selectedIssue.id);
          setComments(issueComments);
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      };
      fetchComments();
    }
  }, [selectedIssue]);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || issue.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || issue.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open':
        return 'bg-red-100 text-red-800';
      case 'In Progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'Resolved':
      case 'Closed':
        return 'bg-green-100 text-green-800';
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
      case 'Open':
        return <AlertCircleIcon className="w-5 h-5 text-red-600" />;
      case 'In Progress':
        return <ClockIcon className="w-5 h-5 text-yellow-600" />;
      case 'Resolved':
      case 'Closed':
        return <CheckCircleIcon className="w-5 h-5 text-green-600" />;
      default:
        return <ArchiveIcon className="w-5 h-5 text-gray-600" />;
    }
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unknown';
    const u = teamMembers.find(x => x.id === userId);
    return u ? u.name : 'Unknown';
  };

  const getAssetName = (assetId: string | null) => {
    if (!assetId) return 'N/A';
    const a = assets.find(x => x.id === assetId);
    return a ? a.name : 'N/A';
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

  const handleViewIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setShowIssueModal(true);
  };

  const handleSubmitComment = async () => {
    if (!selectedIssue || !newComment.trim()) return;

    setSubmittingComment(true);
    try {
      await commentService.create(selectedIssue.id, newComment.trim());

      // Refresh comments
      const updatedComments = await commentService.getByIssueId(selectedIssue.id);
      setComments(updatedComments);
      setNewComment('');

      addToast({
        title: 'Comment Added',
        message: 'Your comment has been added successfully',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      addToast({
        title: 'Error',
        message: 'Failed to add comment',
        type: 'error',
        duration: 5000
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = (comment: IssueComment) => {
    setEditingComment(comment);
    setEditCommentText(comment.comment);
  };

  const handleCancelEdit = () => {
    setEditingComment(null);
    setEditCommentText('');
  };

  const handleUpdateComment = async () => {
    if (!editingComment || !editCommentText.trim() || !selectedIssue) return;

    try {
      await commentService.update(selectedIssue.id, editingComment.id, editCommentText.trim());
      
      // Update local comments
      setComments(comments.map(comment => 
        comment.id === editingComment.id 
          ? { ...comment, comment: editCommentText.trim() }
          : comment
      ));

      addToast({
        title: 'Comment Updated',
        message: 'Your comment has been updated successfully',
        type: 'success',
        duration: 3000
      });

      setEditingComment(null);
      setEditCommentText('');
    } catch (error) {
      console.error('Error updating comment:', error);
      addToast({
        title: 'Error',
        message: 'Failed to update comment',
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?') || !selectedIssue) return;

    try {
      await commentService.delete(selectedIssue.id, commentId);
      
      // Remove comment from local state
      setComments(comments.filter(comment => comment.id !== commentId));

      addToast({
        title: 'Comment Deleted',
        message: 'Comment has been deleted successfully',
        type: 'success',
        duration: 3000
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      addToast({
        title: 'Error',
        message: 'Failed to delete comment',
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleEscalateIssue = async (issue: Issue) => {
    try {
      // Update issue priority to critical
      await issueService.update(issue.id, {
        priority: 'critical'
      });

      // Update local issues
      setIssues(issues.map(i => 
        i.id === issue.id 
          ? { ...i, priority: 'critical' }
          : i
      ));

      // Update selected issue if it's the same
      if (selectedIssue && selectedIssue.id === issue.id) {
        setSelectedIssue({ ...selectedIssue, priority: 'critical' });
      }

      addToast({
        title: 'Issue Escalated',
        message: 'Issue has been escalated to critical priority',
        type: 'success',
        duration: 5000
      });
    } catch (error) {
      console.error('Error escalating issue:', error);
      addToast({
        title: 'Error',
        message: 'Failed to escalate issue',
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleReportIssue = () => {
    setNewIssue({
      title: '',
      description: '',
      priority: 'medium',
      asset_id: ''
    });
    setShowReportModal(true);
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

    setSubmittingIssue(true);

    try {
      await issueService.create({
        title: newIssue.title.trim(),
        description: newIssue.description.trim(),
        priority: newIssue.priority,
        asset_id: newIssue.asset_id || null
      });

      addToast({
        title: 'Issue Reported',
        message: 'Issue has been reported successfully',
        type: 'success',
        duration: 3000
      });

      setShowReportModal(false);
      setNewIssue({
        title: '',
        description: '',
        priority: 'medium',
        asset_id: ''
      });

      // Refresh issues
      const updatedIssues = await issueService.getAll();
      const departmentMemberIds = teamMembers.map(member => member.id);
      const departmentAssetIds = assets.map(asset => asset.id);
      const departmentIssues = updatedIssues.filter(issue => 
        departmentMemberIds.includes(issue.reported_by) || 
        (issue.asset_id && departmentAssetIds.includes(issue.asset_id))
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

  const buildHtmlTable = (data: Issue[]) => {
    const headers = ['Title', 'Status', 'Priority', 'Reported By', 'Asset', 'Created At'];
    const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const thead = `<thead><tr>${headers.map(h => `<th style="text-align:left;border:1px solid #ccc;padding:6px;font-weight:bold;background:#f3f4f6;">${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${data.map(i => `<tr>${[
      i.title,
      i.status,
      i.priority || 'N/A',
      getUserName(i.reported_by),
      getAssetName(i.asset_id),
      formatDate(i.created_at)
    ].map(v => `<td style="border:1px solid #ccc;padding:6px;">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    return `<table style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;">${thead}${tbody}</table>`;
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = filteredIssues;
      if (!data || data.length === 0) {
        addToast({ title: 'No Data', message: 'No issues match the current filters to export.', type: 'warning', duration: 3000 });
        setIsExporting(false);
        return;
      }

      if (exportFormat === 'csv') {
        const headers = ['Title', 'Description', 'Status', 'Priority', 'Reported By', 'Asset', 'Created At'];
        const csvRows: string[] = [];
        csvRows.push(headers.join(','));
        
        for (const i of data) {
          const row = [
            i.title || '',
            i.description || '',
            i.status || '',
            i.priority || '',
            getUserName(i.reported_by),
            getAssetName(i.asset_id),
            formatDate(i.created_at)
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
        link.setAttribute('download', `DepartmentIssues_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        const exportData = data.map(i => ({
          title: i.title,
          description: i.description,
          status: i.status,
          priority: i.priority || '',
          reported_by: getUserName(i.reported_by),
          asset: getAssetName(i.asset_id),
          created_at: formatDate(i.created_at)
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
        link.setAttribute('download', `DepartmentIssues_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'txt') {
        const headers = ['Title', 'Status', 'Priority', 'Reported By', 'Asset', 'Created At'];
        const rows = data.map(i => [
          i.title || '',
          i.status || '',
          i.priority || '',
          getUserName(i.reported_by),
          getAssetName(i.asset_id),
          formatDate(i.created_at)
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
          'DEPARTMENT ISSUES EXPORT',
          `Exported: ${new Date().toLocaleString()}`,
          `Total Issues: ${data.length}`,
          '',
          headerRow,
          separator,
          ...dataRows
        ].join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentIssues_${new Date().toISOString().slice(0, 10)}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'excel') {
        const headers = ['Title', 'Description', 'Status', 'Priority', 'Reported By', 'Asset', 'Created At'];
        const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const thead = `<thead><tr style="background-color: #2563eb; color: white; font-weight: bold;">${headers.map(h => 
          `<th style="text-align:left; border:1px solid #ccc; padding:12px; font-size:14px;">${h}</th>`
        ).join('')}</tr></thead>`;
        
        const tbody = `<tbody>${data.map((i, idx) => {
          const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
          return `<tr style="background-color: ${bgColor};">${[
            i.title,
            i.description,
            i.status,
            i.priority || '',
            getUserName(i.reported_by),
            getAssetName(i.asset_id),
            formatDate(i.created_at)
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
  <h1>Department Issues Export</h1>
  <div class="info">
    <div>Exported: ${new Date().toLocaleString()}</div>
    <div>Total Issues: ${data.length}</div>
  </div>
  ${table}
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `DepartmentIssues_${new Date().toISOString().slice(0, 10)}.xls`);
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
        doc.text('Department Issues Export', margin, y);
        y += 20;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total issues: ${data.length}`, margin, y);
        y += 25;
        
        const headers = ['Title', 'Status', 'Priority', 'Reported By', 'Asset', 'Created'];
        const colWidths = [120, 70, 60, 90, 90, 70];
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
        
        for (const i of data) {
          if (y + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            y = drawRow(headers, true, y);
          }
          
          const cells = [
            i.title,
            i.status,
            i.priority || 'N/A',
            getUserName(i.reported_by),
            getAssetName(i.asset_id),
            formatDate(i.created_at)
          ];
          y = drawRow(cells, false, y);
        }
        
        doc.save(`DepartmentIssues_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      addToast({ title: 'Export Complete', message: 'Issues exported successfully.', type: 'success', duration: 3000 });
    } catch (e: any) {
      console.error('Export error:', e);
      addToast({ title: 'Export Failed', message: e?.message || 'Could not export issues.', type: 'error', duration: 5000 });
    } finally {
      setIsExporting(false);
    }
  };

  const issueStats = {
    total: issues.length,
    open: issues.filter(i => i.status === 'Open').length,
    inProgress: issues.filter(i => i.status === 'In Progress').length,
    resolved: issues.filter(i => i.status === 'Resolved' || i.status === 'Closed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading department issues...</p>
        </div>
      </div>
    );
  }

  if (!user?.department_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircleIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
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
            <h1 className="text-3xl font-bold text-primary">Department Issues</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Manage and track issues reported by your team members
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReportIssue}
              className="px-6 py-3 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 transition-all duration-200 flex items-center font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              Report New Issue
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
              disabled={isExporting || filteredIssues.length === 0}
              className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 disabled:opacity-50 flex items-center"
            >
              <DownloadIcon className="w-4 h-4 mr-2" /> 
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <AlertCircleIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Issues</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{issueStats.total}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <AlertCircleIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Open Issues</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{issueStats.open}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <ClockIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">In Progress</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{issueStats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-green-100 rounded-full">
              <CheckCircleIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Resolved</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{issueStats.resolved}</p>
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
              placeholder="Search issues..."
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
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
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

      {/* Issues List */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Issues ({filteredIssues.length})</h2>
        
        {filteredIssues.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircleIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No issues found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue) => (
              <div key={issue.id} className="p-6 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-full ${issue.status === 'Open' ? 'bg-red-100' : issue.status === 'In Progress' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                        {getStatusIcon(issue.status)}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{issue.title}</h3>
                    </div>
                    
                    <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{issue.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <UserIcon className="w-4 h-4 mr-1" />
                        <span>Reported by {getUserName(issue.reported_by)}</span>
                      </div>
                      <div className="flex items-center">
                        <MonitorIcon className="w-4 h-4 mr-1" />
                        <span>Asset: {getAssetName(issue.asset_id)}</span>
                      </div>
                      <div className="flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        <span>{formatDate(issue.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(issue.status)}`}>
                      {issue.status}
                    </span>
                    {issue.priority && (
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(issue.priority)}`}>
                        {issue.priority}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewIssue(issue)}
                      className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                    >
                      <EyeIcon className="w-4 h-4 mr-1 inline" />
                      View Details
                    </button>
                    <button
                      onClick={() => handleEscalateIssue(issue)}
                      className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-colors"
                    >
                      <TrendingUpIcon className="w-4 h-4 mr-1 inline" />
                      Escalate
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Issue #{issue.id.slice(-8)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Issue Details Modal */}
      {showIssueModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Issue Details</h3>
              <button
                onClick={() => setShowIssueModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Issue Header */}
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-full ${selectedIssue.status === 'Open' ? 'bg-red-100' : selectedIssue.status === 'In Progress' ? 'bg-yellow-100' : 'bg-green-100'}`}>
                  {getStatusIcon(selectedIssue.status)}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{selectedIssue.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span>Reported by {getUserName(selectedIssue.reported_by)}</span>
                    <span>•</span>
                    <span>{formatDate(selectedIssue.created_at)}</span>
                    <span>•</span>
                    <span>Asset: {getAssetName(selectedIssue.asset_id)}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedIssue.status)}`}>
                    {selectedIssue.status}
                  </span>
                  {selectedIssue.priority && (
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${getPriorityColor(selectedIssue.priority)}`}>
                      {selectedIssue.priority}
                    </span>
                  )}
                </div>
              </div>

              {/* Issue Description */}
              <div>
                <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h5>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selectedIssue.description}</p>
              </div>

              {/* Comments Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Comments ({comments.length})</h5>
                  <button
                    onClick={() => setShowIssueModal(false)}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Refresh Comments
                  </button>
                </div>
                
                <div className="space-y-4 mb-4 max-h-60 overflow-y-auto">
                  {comments.length === 0 ? (
                    <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                      <MessageSquareIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No comments yet. Be the first to comment!</p>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-semibold mr-3">
                              {getUserName(comment.commented_by).charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {getUserName(comment.commented_by)}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                {formatDate(comment.created_at)}
                              </span>
                            </div>
                          </div>
                          {comment.commented_by === user?.id && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => handleEditComment(comment)}
                                className="p-1 text-gray-400 hover:text-primary transition-colors"
                                title="Edit comment"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                title="Delete comment"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {editingComment && editingComment.id === comment.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                              rows={3}
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={handleUpdateComment}
                                className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary/90 transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{comment.comment}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Add a comment</span>
                  </div>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your thoughts on this issue..."
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    rows={3}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmitComment}
                      disabled={!newComment.trim() || submittingComment}
                      className="px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center font-medium"
                    >
                      {submittingComment ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <MessageSquareIcon className="w-4 h-4 mr-2" />
                          Add Comment
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-600">
                {selectedIssue.priority !== 'critical' ? (
                  <button
                    onClick={() => handleEscalateIssue(selectedIssue)}
                    className="flex-1 px-4 py-2 text-orange-600 border border-orange-600 rounded-lg hover:bg-orange-600 hover:text-white transition-colors flex items-center justify-center"
                  >
                    <TrendingUpIcon className="w-4 h-4 mr-2" />
                    Escalate to Critical
                  </button>
                ) : (
                  <div className="flex-1 px-4 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Already Critical Priority
                  </div>
                )}
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Report New Issue</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
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
                  placeholder="Brief description of the issue"
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
                  placeholder="Detailed description of the issue"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Related Asset (Optional)
                </label>
                <select
                  value={newIssue.asset_id}
                  onChange={(e) => setNewIssue({ ...newIssue, asset_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select an asset (optional)</option>
                  {assets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} - {asset.serial_number}
                    </option>
                  ))}
                </select>
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
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-primary to-purple-600 text-white rounded-lg hover:from-primary/90 hover:to-purple-600/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center font-medium shadow-md hover:shadow-lg"
                >
                  {submittingIssue ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending Issue...
                    </>
                  ) : (
                    <>
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Report Issue
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowReportModal(false)}
                  disabled={submittingIssue}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentIssues;
