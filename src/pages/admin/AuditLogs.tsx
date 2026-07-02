import React, { useEffect, useMemo, useState } from 'react';
import { auditService, userService } from '../../services/apiDatabase';
import { AuditLog, User } from '../../lib/supabase';
import { 
  DownloadIcon, 
  RefreshCwIcon, 
  SearchIcon, 
  FilterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CalendarIcon,
  UserIcon,
  ActivityIcon,
  XIcon,
  EyeIcon
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';

const AuditLogs: React.FC = () => {
  const { addToast } = useNotifications();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'pdf'>('csv');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Details view
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  
  // Statistics
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        ...(filterUserId && { user_id: filterUserId }),
        ...(filterAction && { action: filterAction }),
        ...(filterEntityType && { entity_type: filterEntityType }),
        ...(filterStartDate && { start_date: filterStartDate }),
        ...(filterEndDate && { end_date: filterEndDate })
      };
      
      const response = await auditService.getAll(params);
      setLogs(response.audit_logs || []);
      setTotal(response.pagination?.total || 0);
      setTotalPages(response.pagination?.pages || 0);
    } catch (error: any) {
      console.error('Error loading audit logs:', error);
      addToast({
        title: 'Error',
        message: 'Failed to load audit logs',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const params: any = {};
      if (filterStartDate) params.start_date = filterStartDate;
      if (filterEndDate) params.end_date = filterEndDate;
      
      const statistics = await auditService.getStats(params);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading statistics:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [page, limit, filterUserId, filterAction, filterEntityType, filterStartDate, filterEndDate]);

  useEffect(() => {
    loadStats();
  }, [filterStartDate, filterEndDate]);

  useEffect(() => {
    (async () => {
      try {
        const users = await userService.getAll();
        const map = new Map<string, string>();
        (users as User[]).forEach(u => map.set(u.id, u.name || u.email));
        setUserMap(map);
      } catch {}
    })();
  }, []);

  const toggleLogExpansion = (logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setFilterUserId('');
    setFilterAction('');
    setFilterEntityType('');
    setFilterStartDate('');
    setFilterEndDate('');
    setPage(1);
  };

  const hasActiveFilters = filterUserId || filterAction || filterEntityType || filterStartDate || filterEndDate;

  // Get unique actions and entity types for filter dropdowns
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach(log => actions.add(log.action));
    return Array.from(actions).sort();
  }, [logs]);

  const uniqueEntityTypes = useMemo(() => {
    const types = new Set<string>();
    logs.forEach(log => types.add(log.entity_type));
    return Array.from(types).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (!search) return logs;
    const s = search.toLowerCase();
    return logs.filter(l =>
      (l.action || '').toLowerCase().includes(s) ||
      (l.entity_type || '').toLowerCase().includes(s) ||
      (l.entity_id || '').toLowerCase().includes(s) ||
      (l.user_id || '').toLowerCase().includes(s) ||
      (userMap.get(l.user_id || '') || '').toLowerCase().includes(s) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(s)
    );
  }, [logs, search, userMap]);

  const exportCsv = () => {
    const rows = [
      ['Time', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details', 'IP Address', 'User Agent']
    ];
    for (const l of filtered) {
      const user = l.user_id ? (userMap.get(l.user_id) || l.user_id) : 'System';
      rows.push([
        new Date(l.created_at).toISOString(),
        user,
        l.action,
        l.entity_type,
        l.entity_id || '',
        JSON.stringify(l.details || {}),
        (l as any).ip_address || '',
        (l as any).user_agent || ''
      ]);
    }
    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g,'""') + '"' : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.setAttribute('download', `audit_logs_${Date.now()}.csv`); 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const payload = filtered.map(l => ({
      created_at: l.created_at,
      user: l.user_id ? (userMap.get(l.user_id) || l.user_id) : 'System',
      action: l.action,
      entity_type: l.entity_type,
      entity_id: l.entity_id,
      details: l.details || {},
      ip_address: (l as any).ip_address || null,
      user_agent: (l as any).user_agent || null
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.setAttribute('download', `audit_logs_${Date.now()}.json`); 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
  };

  const exportTxt = () => {
    const lines = filtered.map(l => {
      const user = l.user_id ? (userMap.get(l.user_id) || l.user_id) : 'System';
      return `${new Date(l.created_at).toISOString()}\t${user}\t${l.action}\t${l.entity_type}\t${l.entity_id || ''}\t${JSON.stringify(l.details || {})}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); 
    a.href = url; 
    a.setAttribute('download', `audit_logs_${Date.now()}.txt`); 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
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
    const data = filtered;
    const format = data.length > 25 ? 'A3' : 'A4';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format });
    const margin = 36; let y = margin;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Audit Logs', margin, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y); y += 14;
    const headers = ['Time','User','Action','Entity','Entity ID','Details'];
    const weights = [16,12,16,12,14,30];
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - margin*2;
    const colWidths = weights.map(w => Math.floor((w/weights.reduce((a,b)=>a+b,0))*availableWidth));
    const baseLineHeight = 12; const cellPadding = 6;
    const measureRowHeight = (cells: string[]) => {
      let maxLines = 1;
      for (let i=0;i<cells.length;i++){
        const lines = doc.splitTextToSize(String(cells[i]??''), colWidths[i]-cellPadding) as string[];
        if (lines.length>maxLines) maxLines = lines.length;
      }
      return Math.max(18, maxLines*baseLineHeight+8);
    };
    const drawRow = (cells: string[], isHeader=false) => {
      let x = margin; const rowH = measureRowHeight(cells);
      doc.setFont('helvetica', isHeader?'bold':'normal'); doc.setFontSize(isHeader?10:9);
      for (let i=0;i<cells.length;i++){
        const lines = doc.splitTextToSize(String(cells[i]??''), colWidths[i]-cellPadding) as string[];
        doc.text(lines, x+3, y+12, { baseline: 'alphabetic' });
        doc.rect(x, y, colWidths[i], rowH);
        x += colWidths[i];
      }
      y += rowH;
    };
    drawRow(headers, true);
    for (const l of data) {
      const user = l.user_id ? (userMap.get(l.user_id) || l.user_id) : 'System';
      const row = [new Date(l.created_at).toLocaleString(), user, l.action, l.entity_type, l.entity_id || '', JSON.stringify(l.details || {})];
      if (y + measureRowHeight(row) > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage(); y = margin; drawRow(headers, true);
      }
      drawRow(row);
    }
    doc.save(`audit_logs_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const formatDetails = (details: any) => {
    if (!details) return 'No details';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin" />
          <p className="mt-4 text-gray-600 dark:text-gray-300">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-primary">Audit Logs</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input 
              className="pl-9 pr-3 py-2 border rounded-xl dark:bg-gray-800 dark:border-gray-700" 
              placeholder="Search..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`px-4 py-2 text-sm font-medium rounded-full shadow-button hover:opacity-90 flex items-center ${
              showFilters || hasActiveFilters 
                ? 'text-white bg-primary' 
                : 'text-primary bg-lightred'
            }`}
          >
            <FilterIcon className="w-4 h-4 mr-1" />
            Filters
          </button>
          <button 
            onClick={loadLogs} 
            className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90"
          >
            <RefreshCwIcon className="w-4 h-4 mr-1 inline" /> Refresh
          </button>
          <select 
            value={exportFormat} 
            onChange={e => setExportFormat(e.target.value as any)} 
            className="px-3 py-2 text-sm border rounded-xl dark:bg-gray-800 dark:border-gray-700"
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
            <option value="txt">Text (.txt)</option>
            <option value="pdf">PDF</option>
          </select>
          <button 
            onClick={() => {
              if (exportFormat === 'csv') exportCsv();
              else if (exportFormat === 'json') exportJson();
              else if (exportFormat === 'txt') exportTxt();
              else exportPdf();
            }} 
            className="px-4 py-2 text-sm font-medium text-secondary bg-lightblue rounded-full shadow-button hover:opacity-90"
          >
            <DownloadIcon className="w-4 h-4 mr-1 inline" /> Export
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Actions</p>
                <p className="text-2xl font-bold text-primary">{stats.total_actions || 0}</p>
              </div>
              <ActivityIcon className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unique Users</p>
                <p className="text-2xl font-bold text-primary">{stats.unique_users || 0}</p>
              </div>
              <UserIcon className="w-8 h-8 text-primary opacity-50" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Creates</p>
                <p className="text-2xl font-bold text-green-600">{stats.create_count || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Updates</p>
                <p className="text-2xl font-bold text-blue-600">{stats.update_count || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filter Logs</h2>
            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 flex items-center"
              >
                <XIcon className="w-4 h-4 mr-1" />
                Clear All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                User
              </label>
              <select
                value={filterUserId}
                onChange={e => { setFilterUserId(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="">All Users</option>
                {Array.from(userMap.entries()).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Action
              </label>
              <select
                value={filterAction}
                onChange={e => { setFilterAction(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>{action}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Entity Type
              </label>
              <select
                value={filterEntityType}
                onChange={e => { setFilterEntityType(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              >
                <option value="">All Entities</option>
                {uniqueEntityTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filterStartDate}
                onChange={e => { setFilterStartDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filterEndDate}
                onChange={e => { setFilterEndDate(e.target.value); setPage(1); }}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card overflow-x-auto">
        <div className="p-4 flex items-center justify-between border-b dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filtered.length} of {total} logs
          </p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">Per page:</label>
            <select
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="text-xs uppercase bg-lightred dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Entity</th>
              <th className="px-6 py-3">Entity ID</th>
              <th className="px-6 py-3">Details</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No audit logs found
                </td>
              </tr>
            ) : (
              filtered.map(l => {
                const isExpanded = expandedLogs.has(l.id);
                return (
                  <React.Fragment key={l.id}>
                    <tr className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-6 py-3 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString('en-US', {
                          timeZone: 'Africa/Nairobi',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-3">
                        {l.user_id ? (userMap.get(l.user_id) || l.user_id) : 'System'}
                      </td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                          {l.entity_type}
                        </span>
                      </td>
                      <td className="px-6 py-3 truncate max-w-[200px] font-mono text-xs">
                        {l.entity_id || '-'}
                      </td>
                      <td className="px-6 py-3 text-xs truncate max-w-[300px]">
                        {JSON.stringify(l.details || {}).substring(0, 100)}
                        {JSON.stringify(l.details || {}).length > 100 && '...'}
                      </td>
                      <td className="px-6 py-3">
                        <button
                          onClick={() => toggleLogExpansion(l.id)}
                          className="text-primary hover:text-primary/80 flex items-center"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUpIcon className="w-4 h-4 mr-1" />
                              Hide
                            </>
                          ) : (
                            <>
                              <EyeIcon className="w-4 h-4 mr-1" />
                              View
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-gray-800/50">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Full Details</h4>
                              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded-lg text-xs overflow-x-auto">
                                {formatDetails(l.details)}
                              </pre>
                            </div>
                            {(l as any).ip_address && (
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">IP Address:</span> {(l as any).ip_address}
                                </div>
                                {(l as any).user_agent && (
                                  <div>
                                    <span className="font-medium">User Agent:</span> {(l as any).user_agent}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 flex items-center justify-between border-t dark:border-gray-800">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed dark:bg-gray-800 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
