import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  UserIcon, 
  MailIcon, 
  PhoneIcon, 
  BuildingIcon, 
  CalendarIcon,
  SearchIcon,
  FilterIcon,
  MessageSquareIcon,
  EyeIcon,
  DownloadIcon
} from 'lucide-react';
import { userService, departmentService } from '../../services/apiDatabase';
import { User, Department } from '../../lib/supabase';
import Logo from '../../assets/logo.png';

const TeamMembers: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  useEffect(() => {
    if (!user?.department_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fTeamMembers, fDepartment] = await Promise.all([
          userService.getByDepartment(user.department_id!),
          departmentService.getById(user.department_id!)
        ]);

        setTeamMembers(fTeamMembers);
        setDepartment(fDepartment);
      } catch (error) {
        console.error('Error fetching team data:', error);
        addToast({
          title: 'Error',
          message: 'Failed to load team members data',
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?.department_id]);

  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (member.position && member.position.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-blue-100 text-blue-800';
      case 'user':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleViewMember = (member: User) => {
    setSelectedMember(member);
    setShowMemberModal(true);
  };

  const handleSendMessage = (_member: User) => {
    // TODO: Implement messaging functionality
    addToast({
      title: 'Feature Coming Soon',
      message: 'Team messaging feature will be available soon',
      type: 'info',
      duration: 3000
    });
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = filteredMembers;
      if (!data || data.length === 0) {
        addToast({ title: 'No Data', message: 'No team members match the current filters to export.', type: 'warning', duration: 3000 });
        setIsExporting(false);
        return;
      }

      if (exportFormat === 'csv') {
        // CSV with UTF-8 BOM for Excel compatibility
        const headers = ['Name', 'Email', 'Role', 'Position', 'Phone', 'Status', 'Created At'];
        const csvRows: string[] = [];
        csvRows.push(headers.join(','));
        
        for (const m of data) {
          const row = [
            m.name || '',
            m.email || '',
            m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : '',
            m.position || '',
            m.phone || '',
            m.is_active ? 'Active' : 'Inactive',
            formatDate(m.created_at)
          ].map(v => {
            const s = String(v).replace(/[\r\n]+/g, ' ').trim();
            return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s;
          }).join(',');
          csvRows.push(row);
        }
        
        // Add UTF-8 BOM for Excel
        const BOM = '\uFEFF';
        const csvContent = BOM + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `TeamMembers_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        // Clean JSON with formatted data
        const exportData = data.map(m => ({
          name: m.name,
          email: m.email,
          role: m.role.charAt(0).toUpperCase() + m.role.slice(1),
          position: m.position || '',
          phone: m.phone || '',
          status: m.is_active ? 'Active' : 'Inactive',
          department: department?.name || '',
          created_at: formatDate(m.created_at)
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
        link.setAttribute('download', `TeamMembers_${new Date().toISOString().slice(0, 10)}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'txt') {
        // Formatted text table with aligned columns
        const headers = ['Name', 'Email', 'Role', 'Position', 'Phone', 'Status', 'Created At'];
        const rows = data.map(m => [
          m.name || '',
          m.email || '',
          m.role ? m.role.charAt(0).toUpperCase() + m.role.slice(1) : '',
          m.position || '',
          m.phone || '',
          m.is_active ? 'Active' : 'Inactive',
          formatDate(m.created_at)
        ]);
        
        // Calculate column widths
        const colWidths = headers.map((h, i) => {
          const maxDataWidth = Math.max(...rows.map(r => String(r[i] || '').length));
          return Math.max(h.length, maxDataWidth, 8);
        });
        
        // Build formatted text
        const separator = colWidths.map(w => '='.repeat(w)).join('  ');
        const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
        const dataRows = rows.map(row => 
          row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('  ')
        );
        
        const textContent = [
          'TEAM MEMBERS EXPORT',
          `Exported: ${new Date().toLocaleString()}`,
          `Total Members: ${data.length}`,
          '',
          headerRow,
          separator,
          ...dataRows
        ].join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `TeamMembers_${new Date().toISOString().slice(0, 10)}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'excel') {
        // Enhanced Excel with better styling
        const headers = ['Name', 'Email', 'Role', 'Position', 'Phone', 'Status', 'Created At'];
        const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        const thead = `<thead><tr style="background-color: #2563eb; color: white; font-weight: bold;">${headers.map(h => 
          `<th style="text-align:left; border:1px solid #ccc; padding:12px; font-size:14px;">${h}</th>`
        ).join('')}</tr></thead>`;
        
        const tbody = `<tbody>${data.map((m, idx) => {
          const bgColor = idx % 2 === 0 ? '#f9fafb' : '#ffffff';
          return `<tr style="background-color: ${bgColor};">${[
            m.name,
            m.email,
            m.role.charAt(0).toUpperCase() + m.role.slice(1),
            m.position || '',
            m.phone || '',
            m.is_active ? 'Active' : 'Inactive',
            formatDate(m.created_at)
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
  <h1>Team Members Export</h1>
  <div class="info">
    <div>Exported: ${new Date().toLocaleString()}</div>
    <div>Total Members: ${data.length}</div>
  </div>
  ${table}
</body>
</html>`;
        
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `TeamMembers_${new Date().toISOString().slice(0, 10)}.xls`);
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
        
        // Use A4 portrait for professional look
        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 40;
        let y = margin;
        
        // Load and add logo
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
        
        // Add logo at top left
        if (logoDataUrl) {
          try {
            doc.addImage(logoDataUrl, 'PNG', margin, y, 100, 40);
          } catch (e) {
            console.error('Failed to add logo:', e);
          }
        }
        
        // Add export date at top right
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const now = new Date();
        const dateStr = `Exported: ${now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}, ${now.toLocaleTimeString('en-US')}`;
        doc.text(dateStr, pageWidth - margin - 140, y + 20, { align: 'left' });
        
        // Move down after header
        y += 60;
        
        // Add title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Team Members Export', margin, y);
        y += 20;
        
        // Add total count
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total members: ${data.length}`, margin, y);
        y += 25;
        
        // Table setup
        const headers = ['Name', 'Email', 'Role', 'Position', 'Phone', 'Status'];
        const colWidths = [100, 120, 60, 80, 80, 60]; // Fixed widths
        const rowHeight = 20;
        const cellPadding = 5;
        
        // Helper function to draw a row
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
        
        // Draw header row
        y = drawRow(headers, true, y);
        
        // Draw data rows
        for (const m of data) {
          if (y + rowHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            y = drawRow(headers, true, y);
          }
          
          const cells = [
            m.name,
            m.email,
            m.role.charAt(0).toUpperCase() + m.role.slice(1),
            m.position || '',
            m.phone || '',
            m.is_active ? 'Active' : 'Inactive'
          ];
          
          y = drawRow(cells, false, y);
        }
        
        doc.save(`TeamMembers_${new Date().toISOString().slice(0, 10)}.pdf`);
      }
      addToast({ title: 'Export Complete', message: 'Team members exported successfully.', type: 'success', duration: 3000 });
    } catch (e: any) {
      console.error('Export error:', e);
      addToast({ title: 'Export Failed', message: e?.message || 'Could not export team members.', type: 'error', duration: 5000 });
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading team members...</p>
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
            <h1 className="text-3xl font-bold text-primary">Team Members</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">
              Manage your {department?.name || 'department'} team members
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
              disabled={isExporting || filteredMembers.length === 0}
              className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 disabled:opacity-50 flex items-center"
            >
              <DownloadIcon className="w-4 h-4 mr-2" /> 
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
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
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <FilterIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Roles</option>
              <option value="manager">Managers</option>
              <option value="user">Users</option>
            </select>
          </div>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightred rounded-full">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Total Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{teamMembers.length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-blue-100 rounded-full">
              <UserIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Active Members</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamMembers.filter(m => m.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <CalendarIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Recently Joined</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {teamMembers.filter(m => {
                  const joinDate = new Date(m.created_at);
                  const thirtyDaysAgo = new Date();
                  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                  return joinDate > thirtyDaysAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Team Members List */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="text-xl font-bold text-primary mb-6">Team Members ({filteredMembers.length})</h2>
        
        {filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <UserIcon className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">No team members found</h3>
            <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map((member) => (
              <div key={member.id} className="p-6 border border-gray-200 dark:border-gray-600 rounded-xl hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{member.name}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{member.position || 'No position'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleViewMember(member)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
                      title="View Details"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSendMessage(member)}
                      className="p-2 text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-primary transition-colors"
                      title="Send Message"
                    >
                      <MessageSquareIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                    <MailIcon className="w-4 h-4 mr-2" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  
                  {member.phone && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
                      <PhoneIcon className="w-4 h-4 mr-2" />
                      <span>{member.phone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(member.role)}`}>
                      {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.is_active)}`}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Joined: {formatDate(member.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Member Details Modal */}
      {showMemberModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Member Details</h3>
              <button
                onClick={() => setShowMemberModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-2xl mx-auto mb-4">
                  {selectedMember.name.charAt(0).toUpperCase()}
                </div>
                <h4 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedMember.name}</h4>
                <p className="text-gray-500 dark:text-gray-400">{selectedMember.position || 'No position'}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center">
                  <MailIcon className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">{selectedMember.email}</span>
                </div>
                
                {selectedMember.phone && (
                  <div className="flex items-center">
                    <PhoneIcon className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                    <span className="text-gray-700 dark:text-gray-300">{selectedMember.phone}</span>
                  </div>
                )}

                <div className="flex items-center">
                  <BuildingIcon className="w-4 h-4 mr-3 text-gray-400 dark:text-gray-500" />
                  <span className="text-gray-700 dark:text-gray-300">{department?.name || 'No department'}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getRoleColor(selectedMember.role)}`}>
                    {selectedMember.role.charAt(0).toUpperCase() + selectedMember.role.slice(1)}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(selectedMember.is_active)}`}>
                    {selectedMember.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <p>Joined: {formatDate(selectedMember.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleSendMessage(selectedMember)}
                  className="flex-1 button-primary flex items-center justify-center"
                >
                  <MessageSquareIcon className="w-4 h-4 mr-2" />
                  Send Message
                </button>
                <button
                  onClick={() => setShowMemberModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamMembers;
