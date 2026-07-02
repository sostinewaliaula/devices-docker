import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { PlusIcon, EditIcon, TrashIcon, RefreshCwIcon, CheckCircleIcon, XCircleIcon, SearchIcon, FilterIcon, UploadIcon, DownloadIcon, HistoryIcon, AlertCircleIcon, XIcon, CheckIcon, ImageIcon } from 'lucide-react';
import AssetImage from '../../components/AssetImage';
import { Asset, Department, User, AssetHistoryPayload, AssetAssignmentHistoryEntry, AssetIssueEventEntry, AssetType, DropdownOption } from '../../lib/supabase';
import { assetService, departmentService, userService, assetRequestTypeService, assetTypeService, notificationService, dropdownOptionsService } from '../../services/apiDatabase';
import { auditService } from '../../services/apiDatabase';
import Logo from '../../assets/logo.png';

export const manufacturers = ['Dell', 'HP', 'Lenovo', 'Apple', 'Microsoft', 'Samsung', 'Cisco', 'Logitech', 'Canon', 'Epson', 'LG', 'ASUS', 'Acer', 'Sony', 'Brother'];
const defaultStatuses = ['active', 'inactive', 'maintenance', 'retired'];
const defaultConditions = ['excellent', 'good', 'fair', 'poor'];
const defaultCategories = ['Electronics', 'Furniture', 'Software', 'Infrastructure', 'Other'];

// Display labels for better UX
const statusLabels: Record<string, string> = {
  'active': 'Active',
  'inactive': 'Inactive',
  'maintenance': 'In Maintenance',
  'retired': 'Retired'
};

const conditionLabels: Record<string, string> = {
  'excellent': 'Excellent',
  'good': 'Good',
  'fair': 'Fair',
  'poor': 'Poor'
};

const AssetManagement: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useNotifications();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [assetRequestTypes, setAssetRequestTypes] = useState<any[]>([]);
  const [assetTypesConfig, setAssetTypesConfig] = useState<AssetType[]>([]);
  const [manufacturersList, setManufacturersList] = useState<string[]>(manufacturers);
  const [categoriesList, setCategoriesList] = useState<string[]>(defaultCategories);
  const [statusesList, setStatusesList] = useState<string[]>(defaultStatuses);
  const [conditionsList, setConditionsList] = useState<string[]>(defaultConditions);
  const [selectedParentDepartment, setSelectedParentDepartment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditAssetModal, setShowEditAssetModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedEditParentDepartment, setSelectedEditParentDepartment] = useState<string>('');
  const [newAsset, setNewAsset] = useState({
    name: '',
    type: 'Laptop',
    category: 'Electronics',
    manufacturer: 'Dell',
    model: '',
    serial_number: '',
    purchase_date: '',
    purchase_price: 0,
    current_value: 0,
    status: 'active',
    condition: 'excellent',
    location: 'Turnkey Africa',
    assigned_to: null as string | null,
    department_id: '' as string,
    warranty_expiry: '',
    last_maintenance: null as string | null,
    notes: '',
    custom_attributes: {} as Record<string, any>
  });
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAsset, setHistoryAsset] = useState<Asset | null>(null);
  const [historyData, setHistoryData] = useState<AssetHistoryPayload | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'ownership' | 'issues'>('ownership');

  // Inline department creation states
  const [isAddingParentDept, setIsAddingParentDept] = useState(false);
  const [newParentDeptTempName, setNewParentDeptTempName] = useState('');
  const [isSavingParentDept, setIsSavingParentDept] = useState(false);

  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptTempName, setNewDeptTempName] = useState('');
  const [isSavingDept, setIsSavingDept] = useState(false);


  // Select all handler
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAssetIds(filteredAssets.map(a => a.id));
    } else {
      setSelectedAssetIds([]);
    }
  };

  // Select one handler
  const handleSelectOne = (id: string, checked: boolean) => {
    setSelectedAssetIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  // Bulk delete handler (opens modal)
  const handleBulkDelete = () => {
    setShowBulkDeleteModal(true);
  };

  // Confirm bulk delete
  const confirmBulkDelete = async () => {
    for (const id of selectedAssetIds) {
      await assetService.delete(id);
    }
    setAssets(prev => prev.filter(a => !selectedAssetIds.includes(a.id)));
    setFilteredAssets(prev => prev.filter(a => !selectedAssetIds.includes(a.id)));
    setSelectedAssetIds([]);
    setShowBulkDeleteModal(false);
    addToast({ title: 'Assets Deleted', message: 'Selected assets have been deleted.', type: 'success' });
  };

  const handleViewHistory = async (asset: Asset) => {
    setHistoryAsset(asset);
    setShowHistoryModal(true);
    setHistoryTab('ownership');
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const historyPayload = await assetService.getHistory(asset.id);
      setHistoryData(historyPayload);
    } catch (error: any) {
      console.error('Failed to load asset history:', error);
      addToast({
        title: 'Error',
        message: error?.response?.data?.message || 'Failed to load asset history.',
        type: 'error'
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryAsset(null);
    setHistoryData(null);
    setHistoryLoading(false);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const formatDateRange = (start?: string | null, end?: string | null) => {
    const startLabel = start ? formatDateTime(start) : 'Unknown start';
    const endLabel = end ? formatDateTime(end) : 'Present';
    return `${startLabel} — ${endLabel} `;
  };

  const getIssuesDuringAssignment = (assignment: AssetAssignmentHistoryEntry): AssetIssueEventEntry[] => {
    if (!historyData?.issueEvents?.length) return [];
    const start = assignment.assigned_at ? new Date(assignment.assigned_at).getTime() : 0;
    const end = assignment.returned_at ? new Date(assignment.returned_at).getTime() : Date.now();
    return historyData.issueEvents.filter((event: AssetIssueEventEntry) => {
      if (!event.occurred_at) return false;
      const when = new Date(event.occurred_at).getTime();
      return when >= start && when <= end;
    });
  };

  const handleCreateParentDept = async (e: React.MouseEvent, isEditMode: boolean = false) => {
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
      setDepartments(deptData);

      // Auto-select the new parent department
      if (isEditMode) {
        setSelectedEditParentDepartment(createdDept.id);
        if (editingAsset) setEditingAsset({ ...editingAsset, department_id: '' } as Asset);
      } else {
        setSelectedParentDepartment(createdDept.id);
        setNewAsset({ ...newAsset, department_id: '' });
      }

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

  const handleCreateDept = async (e: React.MouseEvent, isEditMode: boolean = false) => {
    e.preventDefault();
    if (!newDeptTempName.trim()) {
      addToast({ title: 'Validation Error', message: 'Department name cannot be empty.', type: 'warning' });
      return;
    }

    const parentDeptId = isEditMode ? selectedEditParentDepartment : selectedParentDepartment;

    if (!parentDeptId) {
      addToast({ title: 'Validation Error', message: 'Please select a parent department first.', type: 'warning' });
      return;
    }

    try {
      setIsSavingDept(true);
      const parentDept = departments.find(d => d.id === parentDeptId);
      const parentName = parentDept?.name || 'Unknown';
      const fullDeptName = `${newDeptTempName.trim()} - ${parentName} `;

      const response = await departmentService.create({
        name: fullDeptName,
        parent_id: parentDeptId,
        location: 'Turnkey Africa'
      });

      const createdDept = (response as any).department || response;

      // Refresh departments
      const deptData = await departmentService.getAll();
      setDepartments(deptData);

      // Auto-select the new department
      if (isEditMode && editingAsset) {
        setEditingAsset({ ...editingAsset, department_id: createdDept.id } as Asset);
      } else {
        setNewAsset({ ...newAsset, department_id: createdDept.id });
      }

      // Reset state
      setNewDeptTempName('');
      setIsAddingDept(false);

      addToast({ title: 'Success', message: 'Sub-department created and selected.', type: 'success' });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create sub-department.',
        type: 'error'
      });
    } finally {
      setIsSavingDept(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  // Fetch assets, departments, and users from database
  const fetchData = useCallback(async () => {
    // console.log('🔄 AssetManagement: fetchData called');
    try {
      setLoading(true);
      setError(null);

      const [assetsData, departmentsData, usersData, typesData, typesConfigData, optionsData] = await Promise.all([
        assetService.getAll().catch(err => {
          console.error('Asset Service Error:', err);
          throw err;
        }),
        departmentService.getAll().catch(err => {
          console.error('Department Service Error:', err);
          throw err;
        }),
        userService.getAll().catch(err => {
          console.error('User Service Error:', err);
          throw err;
        }),
        assetRequestTypeService.getAll().catch(err => {
          console.error('Asset Request Type Service Error:', err);
          return [];
        }),
        assetTypeService.getAll(true).catch(err => {
          console.error('Asset Type Service Error:', err);
          return [];
        }),
        dropdownOptionsService.getAll().catch(err => {
          console.error('Dropdown Options Error:', err);
          return [];
        })
      ]);
      setAssets(assetsData);
      setFilteredAssets(assetsData);
      setDepartments(departmentsData);
      setUsers(usersData);
      setAssetRequestTypes(typesData);
      setAssetTypesConfig(typesConfigData);

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
    } catch (err: any) {
      console.error('Fetch Data Error overall:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Failed to load asset data.';
      setError(errorMessage);
      // addNotification implementation requires a full Notification object. 
      // Since addToast is used, we'll rely on that for immediate feedback.
      addToast({
        title: 'Error',
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const loadAssets = fetchData; // Alias fetchData to loadAssets as per instruction

  useEffect(() => {
    // console.log('🚀 AssetManagement: fetchData useEffect triggered');
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Filter assets based on search term and filters
    let result = assets;

    if (searchTerm) {
      result = result.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.type.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== 'All') {
      result = result.filter(asset => asset.type === filterType);
    }

    if (filterStatus !== 'All') {
      result = result.filter(asset => asset.status === filterStatus);
    }

    if (filterDepartment !== 'All') {
      result = result.filter(asset => asset.department_id === filterDepartment);
    }

    setFilteredAssets(result);
  }, [assets, searchTerm, filterType, filterStatus, filterDepartment]);

  // Export/Import helpers
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');

  // Logo is imported at top-level as Vite asset

  const downloadSampleCsv = () => {
    const headers = ['name', 'type', 'serial_number', 'status', 'location', 'manufacturer', 'department_id', 'assigned_to', 'purchase_date', 'warranty_expiry'];
    const sample = [["MacBook Pro 14\"", 'Laptop', 'SN-ABC123', 'Available', 'Turnkey Africa', 'Apple', '', '', '', '']];
    const rows = [headers.join(','), ...sample.map(r => r.map(v => {
      const s = String(v ?? '');
      return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assets_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const buildHtmlTable = (items: any[]) => {
    const headers = ['name', 'type', 'serial_number', 'status', 'location', 'manufacturer', 'department_id', 'assigned_to', 'purchase_date', 'warranty_expiry'];
    const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const thead = `<thead><tr>${headers.map(h => `<th style="text-align:left;border:1px solid #ccc;padding:6px;">${h}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${items.map(a => `<tr>${[
      a.name, a.type, a.serial_number, a.status, a.location || '', (a as any).manufacturer || '', a.department_id || '', a.assigned_to || '', (a as any).purchase_date || '', (a as any).warranty_expiry || ''
    ].map(v => `<td style="border:1px solid #ccc;padding:6px;">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')
      }</tbody>`;
    return `<table style="border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;">${thead}${tbody}</table>`;
  };

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const data = filteredAssets;
      if (!data || data.length === 0) {
        addToast({ title: 'No Data', message: 'No assets match the current filters to export.', type: 'warning' });
        setIsExporting(false);
        return;
      }
      if (exportFormat === 'csv') {
        const headers = ['name', 'type', 'serial_number', 'status', 'location', 'manufacturer', 'department_id', 'assigned_to', 'purchase_date', 'warranty_expiry'];
        const csvRows: string[] = [];
        csvRows.push(headers.join(','));
        for (const a of data) {
          const row = [
            a.name,
            a.type,
            a.serial_number,
            a.status,
            a.location || '',
            (a as any).manufacturer || '',
            a.department_id || '',
            a.assigned_to || '',
            (a as any).purchase_date || '',
            (a as any).warranty_expiry || ''
          ].map(v => {
            const s = String(v ?? '');
            return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s;
          }).join(',');
          csvRows.push(row);
        }
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `assets_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `assets_export_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'txt') {
        const lines = data.map(a => `${a.name} \t${a.type} \t${a.serial_number} \t${a.status} \t${a.location || ''} `);
        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `assets_export_${Date.now()}.txt`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'excel') {
        const html = `< !DOCTYPE html > <html><head><meta charset="utf-8" /></head><body>${buildHtmlTable(data)}</body></html>`;
        const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `assets_export_${Date.now()}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (exportFormat === 'pdf') {
        // Lazy-load jsPDF UMD build
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
        // Choose larger page if many rows
        const format = data.length > 25 ? 'A3' : 'A4';
        const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 36;
        // Header labels removed per request
        // Convert imported logo to data URL via canvas (works for same-origin assets bundled by Vite)
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
              } catch { resolve(''); }
            };
            img.onerror = () => resolve('');
            img.src = (Logo as unknown as string);
          } catch { resolve(''); }
        });
        // Header
        let y = margin;
        if (logoDataUrl) {
          try { doc.addImage(logoDataUrl, 'PNG', margin, y, 120, 48); } catch { }
        }
        // Keep space for logo; omit company/app text
        const dateStr = new Date().toLocaleString();
        doc.setFontSize(10);
        doc.text(`Exported: ${dateStr} `, pageWidth - margin - 180, y + 16);
        y += 56;
        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('Assets Export', margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Total assets: ${data.length} `, margin + 140, y);
        y += 14;
        // Table with dynamic column sizing
        const headers = ['Name', 'Type', 'Serial', 'Status', 'Location', 'Manufacturer', 'Dept', 'Assigned To', 'Purchase', 'Warranty'];
        const weights = [16, 12, 12, 9, 15, 12, 8, 10, 8, 8];
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const availableWidth = pageWidth - margin * 2;
        const colWidths = weights.map(w => Math.floor((w / totalWeight) * availableWidth));
        const baseLineHeight = 12;
        const cellPadding = 6;
        const measureRowHeight = (cells: string[]) => {
          let maxLines = 1;
          for (let i = 0; i < cells.length; i++) {
            const text = String(cells[i] ?? '');
            const maxWidth = colWidths[i] - cellPadding;
            const lines = doc.splitTextToSize(text, maxWidth) as string[];
            if (lines.length > maxLines) maxLines = lines.length;
          }
          return Math.max(18, maxLines * baseLineHeight + 8);
        };
        const drawRow = (cells: string[], isHeader = false) => {
          let x = margin;
          doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
          doc.setFontSize(isHeader ? 10 : 9);
          // determine row height based on wrapped lines
          const wrapped: string[][] = [];
          for (let i = 0; i < cells.length; i++) {
            const text = String(cells[i] ?? '');
            const maxWidth = colWidths[i] - cellPadding;
            const lines = doc.splitTextToSize(text, maxWidth) as string[];
            wrapped.push(lines);
          }
          const rowHeight = measureRowHeight(cells);
          // draw text and cells
          for (let i = 0; i < cells.length; i++) {
            const lines = wrapped[i];
            doc.text(lines, x + 3, y + 12, { baseline: 'alphabetic' });
            doc.rect(x, y, colWidths[i], rowHeight);
            x += colWidths[i];
          }
          y += rowHeight;
        };
        // Header row
        // Ensure room for header; if not, new page first
        const headerHeight = measureRowHeight(headers);
        if (y + headerHeight > pageHeight - margin) {
          doc.addPage(); y = margin;
        }
        drawRow(headers, true);
        // Data rows with pagination
        // lookup helpers for names
        const deptMap = new Map<string, string>(departments.map(d => [d.id, d.name]));
        const userMap = new Map<string, string>(users.map(u => [u.id, u.name]));
        for (const a of data) {
          const cells = [
            a.name,
            a.type,
            a.serial_number || '',
            a.status,
            a.location || '',
            (a as any).manufacturer || '',
            (a as any).department_id ? (deptMap.get((a as any).department_id) || (a as any).department_id) : '',
            (a as any).assigned_to ? (userMap.get((a as any).assigned_to) || (a as any).assigned_to) : '',
            (a as any).purchase_date || '',
            (a as any).warranty_expiry || ''
          ];
          const nextHeight = measureRowHeight(cells);
          if (y + nextHeight > pageHeight - margin) {
            doc.addPage();
            y = margin;
            drawRow(headers, true);
          }
          drawRow(cells);
        }
        const fname = `Assets_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(fname);
      }
      addToast({ title: 'Export', message: `Assets exported as ${exportFormat.toUpperCase()}.`, type: 'success' });
    } catch (e: any) {
      addToast({ title: 'Export Failed', message: e?.message || 'Could not export assets.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    Object.entries(newAsset).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        // Handle specific fields for FormData
        if (key === 'purchase_date' && !value) {
          data.append(key, new Date().toISOString().split('T')[0]);
        } else if (key === 'department_id' && !value) {
          data.append(key, ''); // Send empty string for null department_id
        } else if (key === 'assigned_to' && !value) {
          data.append(key, ''); // Send empty string for null assigned_to
        } else if (key === 'warranty_expiry' && !value) {
          data.append(key, ''); // Send empty string for null warranty_expiry
        } else if (key === 'last_maintenance' && !value) {
          data.append(key, ''); // Send empty string for null last_maintenance
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
      const newAssetData = await assetService.create(data);
      try { await auditService.write({ user_id: null, action: 'asset.create', entity_type: 'asset', entity_id: newAssetData.id, details: { after: newAssetData } }); } catch { }

      // Notify assigned user if asset is assigned at creation
      try {
        if (newAssetData.assigned_to) {
          await notificationService.notifyUser(
            newAssetData.assigned_to,
            'Asset Assigned',
            `You have been assigned the asset "${newAssetData.name}"(SN: ${newAssetData.serial_number || 'N/A'}).`,
            'info'
          );
        }
      } catch (e) {
      }

      // Close the modal and reset the form
      setShowAddAssetModal(false);
      setNewAsset({
        name: '',
        type: 'Laptop',
        category: 'Electronics',
        manufacturer: 'Dell',
        model: '',
        serial_number: '',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_price: 0,
        current_value: 0,
        status: 'active',
        condition: 'excellent',
        location: 'Turnkey Africa',
        assigned_to: null,
        department_id: '',
        warranty_expiry: '',
        last_maintenance: null,
        notes: '',
        custom_attributes: {}
      });
      setSelectedFile(null);
      setImagePreview(null);
      loadAssets();

      // Show a notification
      addToast({
        title: 'Asset Added',
        message: `New asset "${newAssetData.name}" has been added successfully`,
        type: 'success'
      });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to add asset.',
        type: 'error'
      });
    }
  };

  const handleEditAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;

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
      // Capture previous assignment
      const previous = assets.find(a => a.id === editingAsset.id);
      const previousAssignedTo = previous?.assigned_to || null;
      // Update the asset in the database
      const updatedAsset = await assetService.update(editingAsset.id, data);
      try { await auditService.write({ user_id: null, action: 'asset.update', entity_type: 'asset', entity_id: updatedAsset.id, details: { before: previous, after: updatedAsset } }); } catch { }

      // Update the asset in the local state (this will be refreshed by loadAssets)
      // const updatedAssets = assets.map(asset =>
      //   asset.id === editingAsset.id ? updatedAsset : asset
      // );
      // setAssets(updatedAssets);

      // Department stats are automatically updated by database triggers

      // If assignment changed and now assigned, notify the new user
      try {
        if (updatedAsset.assigned_to && updatedAsset.assigned_to !== previousAssignedTo) {
          await notificationService.notifyUser(
            updatedAsset.assigned_to,
            'Asset Assigned',
            `You have been assigned the asset "${updatedAsset.name}"(SN: ${updatedAsset.serial_number || 'N/A'}).`,
            'info'
          );
        }
      } catch (e) {
      }

      // Close the modal and reset the editing state
      setShowEditAssetModal(false);
      setEditingAsset(null);
      addToast({
        title: 'Asset Updated',
        message: `Asset "${updatedAsset.name}" has been updated successfully`,
        type: 'success'
      });
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to update asset.',
        type: 'error'
      });
    }
  };

  const handleDeleteAsset = async () => {
    if (!selectedAsset) return;

    try {
      // Delete the asset from the database
      await assetService.delete(selectedAsset.id);
      try { await auditService.write({ user_id: null, action: 'asset.delete', entity_type: 'asset', entity_id: selectedAsset.id, details: { before: selectedAsset } }); } catch { }

      // Filter out the selected asset
      const updatedAssets = assets.filter(asset => asset.id !== selectedAsset.id);
      setAssets(updatedAssets);
      // Department stats are automatically updated by database triggers

      // Show a notification
      addToast({
        title: 'Asset Deleted',
        message: `Asset "${selectedAsset.name}" has been deleted`,
        type: 'info'
      });
      addToast({
        title: 'Asset Deleted',
        message: `Asset "${selectedAsset.name}" has been deleted`,
        type: 'success'
      });

      // Close the modal and reset the selected asset
      setShowDeleteModal(false);
      setSelectedAsset(null);
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to delete asset.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Failed to delete asset.',
        type: 'error'
      });
    }
  };

  const updateAssetAttribute = (name: string, value: any, isEdit: boolean = false) => {
    const updateFn = isEdit ? setEditingAsset : setNewAsset;
    const currentAsset = isEdit ? (editingAsset as Asset) : (newAsset as any);
    if (!currentAsset) return;

    const updates: any = {
      custom_attributes: {
        ...(currentAsset.custom_attributes || {}),
        [name]: value
      }
    };

    // Map to top-level fields
    switch (name) {
      case 'Serial Number':
        updates.serial_number = value;
        break;
      case 'Status':
        // statusLabels mapping might be needed if value is 'Available' -> 'active'
        const statusMap: Record<string, string> = {
          'Available': 'active',
          'In Use': 'active', // usually handled by status labels
          'active': 'active',
          'inactive': 'inactive',
          'maintenance': 'maintenance',
          'retired': 'retired'
        };
        updates.status = statusMap[value] || value.toLowerCase();
        break;
      case 'Condition':
        updates.condition = value.toLowerCase();
        break;
      case 'Purchase Price (KSh)':
        updates.purchase_price = parseFloat(value) || 0;
        break;
      case 'Current Value (KSh)':
        updates.current_value = parseFloat(value) || 0;
        break;
      case 'Purchase Date':
        updates.purchase_date = value;
        break;
      case 'Warranty End Date':
        updates.warranty_expiry = value;
        break;
      case 'Manufacturer':
        updates.manufacturer = value;
        break;
      case 'Category':
        updates.category = value;
        break;
      case 'Model':
        updates.model = value;
        break;
    }

    if (isEdit) {
      setEditingAsset({ ...currentAsset, ...updates } as Asset);
    } else {
      setNewAsset({ ...currentAsset, ...updates });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-lightred text-primary';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      case 'retired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDepartmentName = (departmentId: string | null) => {
    if (!departmentId) return 'Unassigned';
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'Unknown';
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unassigned';
    const user = users.find(u => u.id === userId);
    return user ? user.name : 'Unknown User';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading assets...</p>
        </div>
      </div>
    );
  }
  return <div className="space-y-6">
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Asset Management</h1>
          <p className="mt-2 text-gray-700 dark:text-gray-300">View, add, edit, and manage all company assets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => {
            setSelectedParentDepartment('');
            setNewAsset({ ...newAsset, department_id: '' });
            setShowAddAssetModal(true);
          }} className="button-primary flex items-center">
            <PlusIcon className="w-4 h-4 mr-2" /> Add New Asset
          </button>
          <Link to="/scan" className="button-primary flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V4a1 1 0 011-1h3M20 7V4a1 1 0 00-1-1h-3M4 17v3a1 1 0 001 1h3M20 17v3a1 1 0 01-1 1h-3M7 12h10M12 7v10" /></svg>
            Scan QR
          </Link>
          <div className="flex items-center gap-2">
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="csv">CSV</option>
              <option value="excel">Excel (.xls)</option>
              <option value="json">JSON</option>
              <option value="txt">Text (.txt)</option>
              <option value="pdf">PDF</option>
            </select>
            <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 disabled:opacity-50" disabled={isExporting}>
              <DownloadIcon className="w-4 h-4 mr-2" /> {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setIsImporting(true);
            try {
              const text = await file.text();
              const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
              if (lines.length <= 1) throw new Error('CSV appears empty.');
              const header = lines[0].split(',').map(h => h.trim().replace(/^\"|\"$/g, ''));
              const idx = (k: string) => header.indexOf(k);
              const nameIdx = idx('name');
              const typeIdx = idx('type');
              const serialIdx = idx('serial_number');
              const statusIdx = idx('status');
              const locationIdx = idx('location');
              const manufacturerIdx = idx('manufacturer');
              const deptIdx = idx('department_id');
              const assignedIdx = idx('assigned_to');
              const purchaseIdx = idx('purchase_date');
              const warrantyIdx = idx('warranty_expiry');
              if ([nameIdx, typeIdx, serialIdx, statusIdx].some(i => i === -1)) {
                throw new Error('CSV missing required headers: name,type,serial_number,status');
              }
              const parseCsvRow = (line: string): string[] => {
                const result: string[] = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                  const char = line[i];
                  if (char === '"') {
                    if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = !inQuotes; }
                  } else if (char === ',' && !inQuotes) {
                    result.push(current); current = '';
                  } else { current += char; }
                }
                result.push(current);
                return result.map(s => s.trim());
              };
              const rows = lines.slice(1).map(parseCsvRow);
              let created = 0;
              for (const r of rows) {
                const get = (i: number) => r[i] ? r[i].replace(/^\"|\"$/g, '') : '';
                const payload: any = {
                  name: get(nameIdx),
                  type: get(typeIdx),
                  serial_number: get(serialIdx),
                  status: get(statusIdx) || 'Available',
                  location: locationIdx >= 0 ? get(locationIdx) : null,
                  manufacturer: manufacturerIdx >= 0 ? get(manufacturerIdx) : null,
                  department_id: deptIdx >= 0 ? get(deptIdx) || null : null,
                  assigned_to: assignedIdx >= 0 ? get(assignedIdx) || null : null,
                  purchase_date: purchaseIdx >= 0 ? get(purchaseIdx) || null : null,
                  warranty_expiry: warrantyIdx >= 0 ? get(warrantyIdx) || null : null
                };
                if (!payload.name || !payload.type || !payload.serial_number) continue;
                try {
                  await assetService.create(payload);
                  created++;
                } catch (err) {
                  // continue on error for individual rows
                }
              }
              addToast({ title: 'Import Complete', message: `Imported ${created} assets from CSV.`, type: 'success' });
              if (typeof window !== 'undefined') {
                window.location.reload();
              }
            } catch (e: any) {
              addToast({ title: 'Import Failed', message: e?.message || 'Could not import CSV.', type: 'error' });
            } finally {
              setIsImporting(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }} />
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-secondary bg-lightblue rounded-full shadow-button hover:opacity-90 disabled:opacity-50" disabled={isImporting}>
            <UploadIcon className="w-4 h-4 mr-2" /> {isImporting ? 'Importing...' : 'Import'}
          </button>
          <button onClick={downloadSampleCsv} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-full shadow-button hover:opacity-90">
            Sample CSV
          </button>
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
            <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Search by name, serial number, or type..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FilterIcon className="w-5 h-5 text-gray-400" />
            </div>
            <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="All">All Types</option>
              {assetTypesConfig.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FilterIcon className="w-5 h-5 text-gray-400" />
            </div>
            <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="All">All Statuses</option>
              {statusesList.map(status => <option key={status} value={status}>{statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}</option>)}
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FilterIcon className="w-5 h-5 text-gray-400" />
            </div>
            <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterDepartment} onChange={e => setFilterDepartment(e.target.value)}>
              <option value="All">All Departments</option>
              {departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </div>
          <button onClick={() => { setSearchTerm(''); setFilterType('All'); setFilterStatus('All'); setFilterDepartment('All'); }} className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 flex items-center">
            <RefreshCwIcon className="w-4 h-4 mr-2" /> Reset Filters
          </button>
        </div>
      </div>
    </div>
    {/* Assets List */}
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary">All Assets</h2>
          <span className="px-3 py-1 text-sm font-medium text-primary bg-lightred rounded-full">{filteredAssets.length} assets</span>
        </div>
        {selectedAssetIds.length > 0 && (
          <div className="mt-4 flex items-center space-x-4">
            <span className="text-sm">{selectedAssetIds.length} selected</span>
            <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Delete Selected</button>
          </div>
        )}
      </div>
      {filteredAssets.length > 0 ? <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
          <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-lightred dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3"><input type="checkbox" checked={selectedAssetIds.length === filteredAssets.length && filteredAssets.length > 0} onChange={e => handleSelectAll(e.target.checked)} /></th>
              <th scope="col" className="px-6 py-3">Asset</th>
              <th scope="col" className="px-6 py-3">Type</th>
              <th scope="col" className="px-6 py-3">Serial Number</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Department</th>
              <th scope="col" className="px-6 py-3">Assigned To</th>
              <th scope="col" className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssets.map(asset => <tr
              key={asset.id}
              className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-lightred/50 dark:hover:bg-gray-800/60 cursor-pointer transition-colors group"
              onClick={() => navigate(`/assets/${asset.id}`)}
            >
              <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                <input type="checkbox" checked={selectedAssetIds.includes(asset.id)} onChange={e => handleSelectOne(asset.id, e.target.checked)} />
              </td>
              <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                <Link to={`/assets/${asset.id}`} className="flex items-center">
                  <div className="w-10 h-10 mr-3 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    <AssetImage asset={asset} assetType={assetRequestTypes.find(t => t.name === asset.type)} />
                  </div>
                  <span>{asset.name}</span>
                </Link>
              </td>
              <td className="px-6 py-4">{asset.type}</td>
              <td className="px-6 py-4">{asset.serial_number}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>{statusLabels[asset.status] || asset.status}</span>
              </td>
              <td className="px-6 py-4">{getDepartmentName(asset.department_id)}</td>
              <td className="px-6 py-4">{asset.assigned_to ? <div className="flex items-center"><div className="p-1 mr-2 text-gray-400 bg-lightred rounded-full dark:bg-gray-800"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path></svg></div><span>{getUserName(asset.assigned_to)}</span></div> : <span className="text-gray-400">Unassigned</span>}</td>
              <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                <div className="flex space-x-2">
                  <Link to={`/assets/${asset.id}`} className="p-1 text-secondary rounded hover:bg-lightblue dark:hover:bg-gray-800" title="View Details" onClick={e => e.stopPropagation()}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></Link>
                  <button
                    onClick={e => { e.stopPropagation(); handleViewHistory(asset); }}
                    className="p-1 text-primary rounded hover:bg-lightred/60 dark:hover:bg-gray-800"
                    title="View History"
                  >
                    <HistoryIcon className="w-5 h-5" />
                  </button>
                  <button onClick={e => {
                    e.stopPropagation();
                    
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
                    
                    // Set parent department based on current asset's department
                    const currentDept = departments.find(d => d.id === asset.department_id);
                    if (currentDept) {
                      if ((currentDept as any).parent_id) {
                        setSelectedEditParentDepartment((currentDept as any).parent_id);
                      } else {
                        setSelectedEditParentDepartment(currentDept.id);
                      }
                    }
                    setShowEditAssetModal(true);
                  }} className="p-1 text-yellow-600 rounded hover:bg-yellow-100 dark:hover:bg-gray-800" title="Edit Asset"><EditIcon className="w-5 h-5" /></button>
                  <button onClick={e => { e.stopPropagation(); setSelectedAsset(asset); setShowDeleteModal(true); }} className="p-1 text-red-600 rounded hover:bg-red-100 dark:hover:bg-gray-800" title="Delete Asset"><TrashIcon className="w-5 h-5" /></button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div> : <div className="flex flex-col items-center justify-center py-12">
        {searchTerm || filterType !== 'All' || filterStatus !== 'All' || filterDepartment !== 'All' ? <>
          <AlertCircleIcon className="w-16 h-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-700">No matching assets found</h3>
          <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
          <button onClick={() => { setSearchTerm(''); setFilterType('All'); setFilterStatus('All'); setFilterDepartment('All'); }} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Clear Filters</button>
        </> : <>
          <CheckCircleIcon className="w-16 h-16 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-700">No assets found</h3>
          <p className="mt-2 text-sm text-gray-500">Get started by adding your first asset</p>
          <button onClick={() => {
            setSelectedParentDepartment('');
            setNewAsset({ ...newAsset, department_id: '' });
            setShowAddAssetModal(true);
          }} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Add New Asset</button>
        </>}
      </div>}
    </div>

    {/* Asset History Modal */}
    {showHistoryModal && historyAsset && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
        <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-card max-h-[90vh] overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-bold text-primary">Asset History</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {historyAsset.name} • {historyAsset.serial_number || 'No serial'}
              </p>
            </div>
            <button onClick={closeHistoryModal} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
          {historyLoading ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-600">
              <RefreshCwIcon className="w-6 h-6 animate-spin mb-2 text-primary" />
              <p>Loading history...</p>
            </div>
          ) : historyData ? (
            <>
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => setHistoryTab('ownership')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${historyTab === 'ownership' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  Ownership timeline
                </button>
                <button
                  onClick={() => setHistoryTab('issues')}
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${historyTab === 'issues' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}`}
                >
                  Issue events
                </button>
              </div>
              {historyTab === 'ownership' ? (
                historyData.assignments.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-300">No assignment history recorded for this asset yet.</p>
                ) : (
                  <div className="space-y-4">
                    {historyData.assignments.map((assignment) => {
                      const issuesDuring = getIssuesDuringAssignment(assignment);
                      return (
                        <div key={assignment.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4 bg-gray-50 dark:bg-gray-800/50">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{assignment.user_name || 'Unassigned'}</p>
                              <p className="text-xs text-gray-500">{formatDateRange(assignment.assigned_at, assignment.returned_at)}</p>
                            </div>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${assignment.returned_at ? 'bg-gray-200 text-gray-700' : 'bg-lightred text-primary'}`}>
                              {assignment.returned_at ? 'Returned' : 'Active'}
                            </span>
                          </div>
                          <div className="mt-4 grid gap-2 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2">
                            <p><span className="font-medium">Department:</span> {assignment.department_name || '—'}</p>
                            <p><span className="font-medium">Location:</span> {assignment.location || '—'}</p>
                            <p><span className="font-medium">Assigned by:</span> {assignment.assigned_by_name || 'System'}</p>
                            <p><span className="font-medium">Condition:</span> {(assignment.condition_on_assign || '—')}{assignment.condition_on_return ? ` → ${assignment.condition_on_return} ` : ''}</p>
                          </div>
                          {assignment.notes && (
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{assignment.notes}</p>
                          )}
                          {issuesDuring.length > 0 && (
                            <div className="mt-4 rounded-xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 p-3">
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Issues during this period</p>
                              <ul className="space-y-2">
                                {issuesDuring.map((event) => (
                                  <li key={event.id} className="text-sm text-gray-700 dark:text-gray-200">
                                    <span className="font-medium">{event.issue_title || 'Issue'}:</span> {event.summary}
                                    <span className="block text-xs text-gray-500">{formatDateTime(event.occurred_at)} • {event.event_type.replace(/_/g, ' ')}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : historyData.issueEvents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300">No issue activity has been recorded for this asset yet.</p>
              ) : (
                <div className="space-y-4">
                  {historyData.issueEvents.map((event) => (
                    <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-2xl p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{event.issue_title || 'Issue'}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-300">{event.summary}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatDateTime(event.occurred_at)}</span>
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-wide text-gray-500">
                        {event.event_type.replace(/_/g, ' ')}
                        {event.status ? ` • ${event.status} ` : ''}
                      </div>
                      {event.details && (
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{event.details}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-600 dark:text-gray-300 py-10">
              Unable to load history details. Please try again later.
            </div>
          )}
        </div>
      </div>
    )}

    {/* Add Asset Modal */}
    {showAddAssetModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-primary">Add New Asset</h3>
          <button onClick={() => setShowAddAssetModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleAddAsset}>
          <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Asset name</label>
              <input type="text" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Dell XPS 15 Laptop" value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} required />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Asset management type</label>
              <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newAsset.type} onChange={e => {
                const selectedType = e.target.value;
                const config = assetTypesConfig.find(t => t.name === selectedType);
                // Pre-populate custom_attributes with defaults if any
                const defaultAttrs: any = {};
                const topLevelUpdates: any = {};
                config?.parameters_schema?.forEach(p => {
                  if (p.name === 'Status') {
                    defaultAttrs[p.name] = 'active';
                    topLevelUpdates.status = 'active';
                  }
                  if (p.name === 'Condition') {
                    defaultAttrs[p.name] = 'excellent';
                    topLevelUpdates.condition = 'excellent';
                  }
                });

                setNewAsset({
                  ...newAsset,
                  ...topLevelUpdates,
                  type: selectedType,
                  custom_attributes: defaultAttrs
                });
              }} required>
                <option value="">Select type</option>
                {assetTypesConfig.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
              </select>
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
                <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={selectedParentDepartment} onChange={e => { setSelectedParentDepartment(e.target.value); setNewAsset({ ...newAsset, department_id: '' }); }} required>
                  <option value="">Select parent</option>
                  {departments.filter(d => !(d as any).parent_id).map(root => (
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
                    onClick={(e) => handleCreateDept(e, false)}
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
                <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newAsset.department_id || ''} onChange={e => setNewAsset({ ...newAsset, department_id: e.target.value || '' })} required>
                  <option value="">Select department</option>
                  {/* Option to assign to root itself */}
                  {departments.filter(d => d.id === selectedParentDepartment).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                  ))}
                  {/* Sub-departments under selected parent */}
                  {departments.filter(d => (d as any).parent_id === selectedParentDepartment).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Assigned To</label>
              <select
                className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={newAsset.assigned_to || ''}
                onChange={e => {
                  const userId = e.target.value || null;
                  const selectedUser = users.find(u => u.id === userId);
                  setNewAsset({
                    ...newAsset,
                    assigned_to: userId,
                    department_id: selectedUser?.department_id || newAsset.department_id
                  });
                  // Update parent department selection if needed
                  if (selectedUser?.department_id) {
                    const dept = departments.find(d => d.id === selectedUser.department_id);
                    if (dept && (dept as any).parent_id) {
                      setSelectedParentDepartment((dept as any).parent_id);
                    } else if (dept) {
                      setSelectedParentDepartment(dept.id);
                    }
                  }
                }}
              >
                <option value="">Select User</option>
                {users.map(user => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Location</label>
              <input
                type="text"
                className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                value="Turnkey Africa"
                readOnly
              />
            </div>
          </div>
          {(() => {
            const selectedTypeConfig = assetTypesConfig.find(t => t.name === newAsset.type);
            if (!selectedTypeConfig?.parameters_schema?.length) return null;
            return (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-primary mb-3">"{selectedTypeConfig.name}" Specific Details</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {selectedTypeConfig.parameters_schema.map(param => (
                    <div key={param.name}>
                        <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{param.name} {param.required && <span className="text-red-500">*</span>}</label>
                        {param.type === 'global_dropdown' ? (
                          <select
                            value={newAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value)}
                            required={param.required}
                            className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                          >
                            <option value="">Select {(param as any).source || 'option'}</option>
                            {(() => {
                              const source = (param as any).source;
                              if (source === 'manufacturer') return manufacturersList.map(m => <option key={m} value={m}>{m}</option>);
                              if (source === 'category') return categoriesList.map(c => <option key={c} value={c}>{c}</option>);
                              if (source === 'status') return statusesList.map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>);
                              if (source === 'condition') return conditionsList.map(c => <option key={c} value={c}>{c}</option>);
                              return null;
                            })()}
                          </select>
                        ) : param.type === 'dropdown' ? (
                          <select
                            value={newAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value)}
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
                              checked={newAsset.custom_attributes?.[param.name] === 'true' || newAsset.custom_attributes?.[param.name] === true}
                              onChange={(e) => updateAssetAttribute(param.name, e.target.checked)}
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                            />
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Yes</span>
                          </div>
                        ) : (
                          <input
                            type={param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'}
                            value={newAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value)}
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
            <label className="block mb-2 text-sm font-medium text-primary">Notes</label>
            <textarea className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" rows={3} placeholder="Additional notes about this asset" value={newAsset.notes} onChange={e => setNewAsset({ ...newAsset, notes: e.target.value })}></textarea>
          </div>
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-primary">Asset Image</label>
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lightred file:text-primary hover:file:opacity-90"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={() => setShowAddAssetModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" className="button-primary px-4 py-2 text-sm font-medium">Add Asset</button>
          </div>
        </form>
      </div>
    </div>}

    {/* Edit Asset Modal */}
    {showEditAssetModal && editingAsset && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-4xl p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-primary">Edit Asset: {editingAsset.name}</h3>
          <button onClick={() => setShowEditAssetModal(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleEditAsset}>
          <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Asset name</label>
              <input type="text" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Dell XPS 15 Laptop" value={editingAsset.name} onChange={e => setEditingAsset({ ...editingAsset, name: e.target.value })} required />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Asset management type</label>
              <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={editingAsset.type} onChange={e => {
                const selectedType = e.target.value;
                const config = assetTypesConfig.find(t => t.name === selectedType);
                // When type changes, we might need to adjust custom_attributes
                setEditingAsset({ ...editingAsset, type: selectedType });
              }} required>
                <option value="">Select type</option>
                {assetTypesConfig.map(type => <option key={type.name} value={type.name}>{type.name}</option>)}
              </select>
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
                    onClick={(e) => handleCreateParentDept(e, true)}
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
                <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={selectedEditParentDepartment} onChange={e => { setSelectedEditParentDepartment(e.target.value); setEditingAsset({ ...editingAsset, department_id: '' } as Asset); }} required>
                  <option value="">Select parent</option>
                  {departments.filter(d => !(d as any).parent_id).map(root => (
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
                    onClick={(e) => handleCreateDept(e, true)}
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
                  {departments.filter(d => d.id === selectedEditParentDepartment).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                  ))}
                  {/* Sub-departments under selected parent */}
                  {departments.filter(d => (d as any).parent_id === selectedEditParentDepartment).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Assigned To</label>
              <select
                className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                value={editingAsset?.assigned_to || ''}
                onChange={e => {
                  const userId = e.target.value || null;
                  const selectedUser = users.find(u => u.id === userId);
                  if (editingAsset) {
                    setEditingAsset({
                      ...editingAsset,
                      assigned_to: userId,
                      department_id: selectedUser?.department_id || editingAsset.department_id
                    } as Asset);
                  }
                  // Update parent department selection if needed
                  if (selectedUser?.department_id) {
                    const dept = departments.find(d => d.id === selectedUser.department_id);
                    if (dept && (dept as any).parent_id) {
                      setSelectedEditParentDepartment((dept as any).parent_id);
                    } else if (dept) {
                      setSelectedEditParentDepartment(dept.id);
                    }
                  }
                }}
              >
                <option value="">Select User</option>
                {users.map(user => <option key={user.id} value={user.id}>{getUserName(user.id)}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-primary">Location</label>
              <input
                type="text"
                className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl"
                value="Turnkey Africa"
                readOnly
              />
            </div>
          </div>
          {(() => {
            const selectedTypeConfig = assetTypesConfig.find(t => t.name === (editingAsset?.type));
            if (!selectedTypeConfig?.parameters_schema?.length) return null;
            return (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-primary mb-3">"{selectedTypeConfig.name}" Specific Details</h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {selectedTypeConfig.parameters_schema.map(param => (
                    <div key={param.name}>
                        <label className="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">{param.name} {param.required && <span className="text-red-500">*</span>}</label>
                        {param.type === 'global_dropdown' ? (
                          <select
                            value={editingAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value, true)}
                            required={param.required}
                            className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200"
                          >
                            <option value="">Select {(param as any).source || 'option'}</option>
                            {(() => {
                              const source = (param as any).source;
                              if (source === 'manufacturer') return manufacturersList.map(m => <option key={m} value={m}>{m}</option>);
                              if (source === 'category') return categoriesList.map(c => <option key={c} value={c}>{c}</option>);
                              if (source === 'status') return statusesList.map(s => <option key={s} value={s}>{statusLabels[s] || s}</option>);
                              if (source === 'condition') return conditionsList.map(c => <option key={c} value={c}>{c}</option>);
                              return null;
                            })()}
                          </select>
                        ) : param.type === 'dropdown' ? (
                          <select
                            value={editingAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value, true)}
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
                              checked={editingAsset.custom_attributes?.[param.name] === 'true' || editingAsset.custom_attributes?.[param.name] === true}
                              onChange={(e) => updateAssetAttribute(param.name, e.target.checked, true)}
                              className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                            />
                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Yes</span>
                          </div>
                        ) : (
                          <input
                            type={param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'}
                            value={editingAsset.custom_attributes?.[param.name] || ''}
                            onChange={(e) => updateAssetAttribute(param.name, e.target.value, true)}
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
            <label className="block mb-2 text-sm font-medium text-primary">Notes</label>
            <textarea className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" rows={3} placeholder="Additional notes about this asset" value={editingAsset?.notes || ''} onChange={e => editingAsset && setEditingAsset({ ...editingAsset, notes: e.target.value } as Asset)}></textarea>
          </div>
          <div className="mb-4">
            <label className="block mb-2 text-sm font-medium text-primary">Asset Image</label>
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                ) : editingAsset?.image_data ? (
                  <AssetImage asset={editingAsset} />
                ) : (
                  <ImageIcon className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-lightred file:text-primary hover:file:opacity-90"
              />
              {editingAsset?.image_data && !imagePreview && (
                <p className="text-xs text-gray-500">Current image shown. Upload new to replace.</p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <button type="button" onClick={() => setShowEditAssetModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
            <button type="submit" className="button-primary px-4 py-2 text-sm font-medium">Save Changes</button>
          </div>
        </form>
      </div>
    </div>}

    {/* Delete Confirmation Modal */}
    {showDeleteModal && selectedAsset && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Confirm Deletion
          </h3>
          <button onClick={() => {
            setShowDeleteModal(false);
            setSelectedAsset(null);
          }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="mb-6">
          <p className="text-gray-700 dark:text-gray-300">
            Are you sure you want to delete the asset "{selectedAsset.name}"? This action cannot be undone.
          </p>
        </div>
        <div className="flex justify-end space-x-2">
          <button onClick={() => {
            setShowDeleteModal(false);
            setSelectedAsset(null);
          }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
            Cancel
          </button>
          <button onClick={handleDeleteAsset} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">
            Delete Asset
          </button>
        </div>
      </div>
    </div>}
    {/* Bulk Delete Confirmation Modal */}
    {showBulkDeleteModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-md p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">Delete Assets</h3>
            <p className="mt-2 text-sm text-gray-500">
              Are you sure you want to delete <b>{selectedAssetIds.length}</b> selected asset{selectedAssetIds.length > 1 ? 's' : ''}? This action cannot be undone.
            </p>
          </div>
          <div className="mt-6 flex space-x-3">
            <button
              onClick={confirmBulkDelete}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700"
            >
              Delete
            </button>
            <button
              onClick={() => setShowBulkDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
  </div>;
};

export default AssetManagement;
