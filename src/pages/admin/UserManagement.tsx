import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { UserIcon, PlusIcon, EditIcon, TrashIcon, SearchIcon, FilterIcon, RefreshCwIcon, AlertCircleIcon, LockIcon, MailIcon, BuildingIcon, XCircleIcon, DownloadIcon, UploadIcon, EyeIcon, EyeOffIcon, CheckIcon, XIcon, UserXIcon, UserCheckIcon } from 'lucide-react';
import Logo from '../../assets/logo.png';
import { Position, User } from '../../lib/supabase';
import { userService, departmentService, positionService } from '../../services/apiDatabase';

interface CreateUserData {
  email: string;
  name: string;
  role: string;
  department_id: string | null;
  position: string | null;
  phone: string | null;
  password: string;
}

const UserManagement: React.FC = () => {
  const { addNotification, addToast } = useNotifications();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string; parent_id: string | null }>>([]);
  const [selectedParentDepartment, setSelectedParentDepartment] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('All');
  const [filterDepartment, setFilterDepartment] = useState('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Active' | 'Suspended'>('All');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'txt' | 'excel' | 'pdf'>('csv');
  const importInputRef = React.useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'user',
    department_id: '',
    position: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [passwordToChange, setPasswordToChange] = useState('');
  const [allPositions, setAllPositions] = useState<Position[]>([]);
  const [isAddingPosition, setIsAddingPosition] = useState(false);
  const [newPositionTempName, setNewPositionTempName] = useState('');
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const [isAddingParentDept, setIsAddingParentDept] = useState(false);
  const [newParentDeptTempName, setNewParentDeptTempName] = useState('');
  const [isSavingParentDept, setIsSavingParentDept] = useState(false);
  const [isAddingDept, setIsAddingDept] = useState(false);
  const [newDeptTempName, setNewDeptTempName] = useState('');
  const [isSavingDept, setIsSavingDept] = useState(false);
  const activePositions = useMemo(
    () => allPositions.filter(position => position.is_active !== false),
    [allPositions]
  );

  // Select all handler
  const handleSelectAllUsers = (checked: boolean) => {
    if (checked) {
      setSelectedUserIds(filteredUsers.map(u => u.id));
    } else {
      setSelectedUserIds([]);
    }
  };

  // Select one handler
  const handleSelectOneUser = (id: string, checked: boolean) => {
    setSelectedUserIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
  };

  // Bulk delete handler (opens modal)
  const handleBulkDeleteUsers = () => {
    setShowBulkDeleteModal(true);
  };

  // Confirm bulk delete
  const confirmBulkDeleteUsers = async () => {
    for (const id of selectedUserIds) {
      await userService.delete(id);
    }
    setUsers(prev => prev.filter(u => !selectedUserIds.includes(u.id)));
    setFilteredUsers(prev => prev.filter(u => !selectedUserIds.includes(u.id)));
    setSelectedUserIds([]);
    setShowBulkDeleteModal(false);
    addToast({ title: 'Users Deleted', message: 'Selected users have been deleted.', type: 'success' });
  };

  const fetchData = useCallback(async () => {
    try {
      // Fetch users
      const fetchedUsers = await userService.getAll();
      setUsers(fetchedUsers);
      setFilteredUsers(fetchedUsers);

      // Fetch departments using API service
      const deptData = await departmentService.getAll();
      setDepartments(deptData.map(d => ({ id: d.id, name: d.name, parent_id: d.parent_id })));
      // Set default parent department to first root
      const roots = deptData.filter(d => !d.parent_id);
      if (roots.length > 0 && !selectedParentDepartment) setSelectedParentDepartment(roots[0].id);

      // Fetch positions
      const fetchedPositions = await positionService.getAll();
      setAllPositions(fetchedPositions);
    } catch (error) {
      addToast({
        title: 'Error',
        message: 'Failed to load data',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  const handleCreatePosition = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!newPositionTempName.trim()) {
      addToast({ title: 'Validation Error', message: 'Position name cannot be empty.', type: 'warning' });
      return;
    }

    try {
      setIsSavingPosition(true);
      const createdPosition = await positionService.create({
        name: newPositionTempName.trim(),
        is_active: true
      });

      // Refresh positions
      const fetchedPositions = await positionService.getAll();
      setAllPositions(fetchedPositions);

      // Auto-select the new position
      setNewUser(prev => ({ ...prev, position: createdPosition.name }));

      // Reset state
      setNewPositionTempName('');
      setIsAddingPosition(false);

      addToast({ title: 'Success', message: 'Position created and selected.', type: 'success' });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create position.',
        type: 'error'
      });
    } finally {
      setIsSavingPosition(false);
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
      setDepartments(deptData.map(d => ({ id: d.id, name: d.name, parent_id: d.parent_id })));

      // Auto-select the new parent department
      setSelectedParentDepartment(createdDept.id);

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
    if (!selectedParentDepartment) {
      addToast({ title: 'Validation Error', message: 'Please select a parent department first.', type: 'warning' });
      return;
    }

    try {
      setIsSavingDept(true);
      const parentDept = departments.find(d => d.id === selectedParentDepartment);
      const parentName = parentDept?.name || 'Unknown';
      const fullDeptName = `${newDeptTempName.trim()} - ${parentName}`;

      const response = await departmentService.create({
        name: fullDeptName,
        parent_id: selectedParentDepartment,
        location: 'Turnkey Africa'
      });

      const createdDept = (response as any).department || response;

      // Refresh departments
      const deptData = await departmentService.getAll();
      setDepartments(deptData.map(d => ({ id: d.id, name: d.name, parent_id: d.parent_id })));

      // Auto-select the new department
      setNewUser({ ...newUser, department_id: createdDept.id });

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

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  useEffect(() => {
    // Filter users based on search term and filters
    let result = users;
    if (searchTerm) {
      result = result.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.position && user.position.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    if (filterRole !== 'All') {
      result = result.filter(user => user.role === filterRole);
    }
    if (filterDepartment !== 'All') {
      result = result.filter(user => getDepartmentName(user.department_id || null) === filterDepartment);
    }
    if (filterStatus === 'Active') {
      result = result.filter(user => user.is_active);
    } else if (filterStatus === 'Suspended') {
      result = result.filter(user => !user.is_active);
    }
    setFilteredUsers(result);
  }, [users, searchTerm, filterRole, filterDepartment, filterStatus]);
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (newUser.password.length < 8) {
        addToast({ title: 'Weak password', message: 'At least 8 characters.', type: 'warning' });
        return;
      }
      if (newUser.password !== newUser.confirmPassword) {
        addToast({ title: 'Password mismatch', message: 'Passwords do not match.', type: 'error' });
        return;
      }
      // Create user using API service
      const userData: CreateUserData = {
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        department_id: newUser.department_id && newUser.department_id.trim() !== '' ? newUser.department_id : null,
        position: newUser.position && newUser.position.trim() !== '' ? newUser.position : null,
        phone: newUser.phone && newUser.phone.trim() !== '' ? newUser.phone : null,
        password: newUser.password
      };

      await userService.create(userData);

      // Refresh the users list
      const fetchedUsers = await userService.getAll();
      setUsers(fetchedUsers);

      // Close modal and reset form
      setShowAddUserModal(false);
      setNewUser({
        name: '',
        email: '',
        role: 'user',
        department_id: '',
        position: '',
        phone: '',
        password: '',
        confirmPassword: ''
      });

      addToast({
        title: 'User Added',
        message: `New user "${newUser.name}" has been added successfully`,
        type: 'success'
      });
      addToast({ title: 'Success', message: 'User created.', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Error', message: error.message || 'Failed to create user. Please try again.', type: 'error' });
    }
  };
  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await userService.update(editingUser.id, {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role as any,
        department_id: newUser.department_id || null,
        position: newUser.position,
        phone: newUser.phone
      });

      // Refresh the users list
      const fetchedUsers = await userService.getAll();
      setUsers(fetchedUsers);

      // Close modal and reset form
      setShowEditUserModal(false);
      setEditingUser(null);
      setNewUser({
        name: '',
        email: '',
        role: 'user',
        department_id: '',
        position: '',
        phone: '',
        password: '',
        confirmPassword: ''
      });

      addToast({
        title: 'User Updated',
        message: `User "${newUser.name}" has been updated successfully`,
        type: 'success'
      });
      addToast({ title: 'Success', message: 'User updated.', type: 'success' });
    } catch (error: any) {
      addToast({ title: 'Error', message: error.message || 'Failed to update user.', type: 'error' });
    }
  };

  const handleToggleUserStatus = async (user: User) => {
    try {
      const newStatus = !user.is_active;
      await userService.update(user.id, { is_active: newStatus });

      setUsers(prev => prev.map(u =>
        u.id === user.id ? { ...u, is_active: newStatus } : u
      ));

      addToast({
        title: newStatus ? 'Account Activated' : 'Account Suspended',
        message: `${user.name}'s account has been ${newStatus ? 'activated' : 'suspended'}.`,
        type: newStatus ? 'success' : 'warning'
      });
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.response?.data?.message || 'Failed to update user status.',
        type: 'error'
      });
    }
  };
  const handleDeleteUser = async () => {
    if (!editingUser) return;
    try {
      await userService.delete(editingUser.id);

      const fetchedUsers = await userService.getAll();
      setUsers(fetchedUsers);

      addToast({ title: 'Deleted', message: `User "${editingUser.name}" has been removed.`, type: 'success' });

      // Close modal and clear state
      setShowDeleteModal(false);
      setEditingUser(null);
    } catch (error: any) {
      console.error('Error deleting user:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to delete user. Please try again.';
      addToast({ title: 'Error', message: errorMessage, type: 'error' });
      // Don't close modal on error so user can try again
    }
  };

  const handleChangePassword = async (user: User) => {
    setEditingUser(user);
    setPasswordToChange('');
    setShowChangePasswordModal(true);
  };

  const handleConfirmPasswordChange = async () => {
    if (!editingUser) return;

    try {
      if (passwordToChange.length < 6) {
        addToast({
          title: 'Weak Password',
          message: 'Password must be at least 6 characters long.',
          type: 'warning'
        });
        return;
      }

      await userService.changePassword(editingUser.id, passwordToChange);

      // Refresh the users list and reset filters to show all users
      const fetchedUsers = await userService.getAll();
      setUsers(fetchedUsers);
      setSearchTerm('');
      setFilterRole('All');
      setFilterDepartment('All');

      addToast({
        title: 'Password Changed',
        message: `Password for ${editingUser.name} has been updated successfully`,
        type: 'success'
      });
      addToast({
        title: 'Success',
        message: 'Password updated successfully',
        type: 'success'
      });

      setShowChangePasswordModal(false);
      setEditingUser(null);
      setPasswordToChange('');
    } catch (error: any) {
      addToast({
        title: 'Error',
        message: error.message || 'Failed to change password. Please try again.',
        type: 'error'
      });
      addToast({
        title: 'Error',
        message: 'Failed to change password',
        type: 'error'
      });
    }
  };
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'manager':
        return 'bg-lightblue text-secondary';
      case 'user':
        return 'bg-lightred text-primary';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const formatRoleName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'manager':
        return 'Department Officer';
      case 'user':
        return 'User';
      default:
        return role;
    }
  };

  const getDepartmentName = (departmentId: string | null | undefined) => {
    if (!departmentId) return 'N/A';
    const dept = departments.find(d => d.id === departmentId);
    return dept ? dept.name : 'N/A';
  };
  const getStatusBadgeClass = (isActive: boolean) => {
    return isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };
  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    </div>;
  }
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">User Management</h1>
            <p className="mt-2 text-gray-700 dark:text-gray-300">View, add, edit, and manage all system users.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowAddUserModal(true)} className="button-primary flex items-center">
              <PlusIcon className="w-4 h-4 mr-2" /> Add New User
            </button>
            <div className="flex items-center gap-2">
              <select value={exportFormat} onChange={e => setExportFormat(e.target.value as any)} className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl">
                <option value="csv">CSV</option>
                <option value="excel">Excel (.xls)</option>
                <option value="json">JSON</option>
                <option value="txt">Text (.txt)</option>
                <option value="pdf">PDF</option>
              </select>
              <button onClick={async () => {
                if (exporting) return; setExporting(true);
                try {
                  const data = filteredUsers;
                  if (!data.length) { addNotification({ title: 'No Data', message: 'No users match the current filters.', type: 'warning' }); setExporting(false); return; }
                  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString() : '';
                  const deptName = (id?: string | null) => { if (!id) return ''; const dept = departments.find(d => d.id === id); return dept?.name || id; };
                  if (exportFormat === 'csv') {
                    const headers = ['name', 'email', 'role', 'department', 'position', 'phone', 'created_at'];
                    const rows: string[] = [headers.join(',')];
                    for (const u of data) {
                      const row = [u.name, u.email, u.role, deptName(u.department_id), u.position || '', u.phone || '', fmtDate(u.created_at)]
                        .map(v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',');
                      rows.push(row);
                    }
                    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.setAttribute('download', `users_export_${Date.now()}.csv`); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  } else if (exportFormat === 'json') {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.setAttribute('download', `users_export_${Date.now()}.json`); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  } else if (exportFormat === 'excel') {
                    const buildHtmlTable = (items: any[]) => {
                      const headers = ['name', 'email', 'role', 'department', 'position', 'phone', 'created_at'];
                      const escapeHtml = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                      const thead = `<thead><tr>${headers.map(h => `<th style=\"text-align:left;border:1px solid #ccc;padding:6px;\">${h}</th>`).join('')}</tr></thead>`;
                      const tbody = `<tbody>${items.map(u => `<tr>${[u.name, u.email, u.role, deptName((u as any).department_id), u.position || '', u.phone || '', fmtDate(u.created_at)].map(v => `<td style=\"border:1px solid #ccc;padding:6px;\">${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody>`;
                      return `<table style=\"border-collapse:collapse;font-family:Arial, sans-serif;font-size:12px;\">${thead}${tbody}</table>`;
                    };
                    const html = `<!DOCTYPE html><html><head><meta charset=\"utf-8\" /></head><body>${buildHtmlTable(data)}</body></html>`;
                    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.setAttribute('download', `users_export_${Date.now()}.xls`); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  } else if (exportFormat === 'pdf') {
                    const ensureJsPdf = () => new Promise<void>((resolve, reject) => {
                      if ((window as any).jspdf?.jsPDF) return resolve();
                      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('Failed to load jsPDF')); document.head.appendChild(s);
                    });
                    await ensureJsPdf(); const { jsPDF } = (window as any).jspdf;
                    const format = data.length > 25 ? 'A3' : 'A4';
                    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format });
                    const pageWidth = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight(); const margin = 36; let y = margin;
                    // Logo like assets
                    const logoDataUrl: string = await new Promise(resolve => {
                      try { const img = new Image(); img.crossOrigin = 'anonymous'; img.onload = () => { try { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); if (ctx) { ctx.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); } else { resolve(''); } } catch { resolve(''); } }; img.onerror = () => resolve(''); img.src = (Logo as unknown as string); } catch { resolve(''); }
                    });
                    if (logoDataUrl) { try { doc.addImage(logoDataUrl, 'PNG', margin, y, 120, 48); } catch { } }
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
                    const dateStr = new Date().toLocaleString(); doc.text(`Exported: ${dateStr}`, pageWidth - margin - 180, y + 16); y += 56;
                    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Users Export', margin, y); y += 14; doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.text(`Total users: ${data.length}`, margin + 120, y); y += 14;
                    const headers = ['Name', 'Email', 'Role', 'Department', 'Position', 'Phone', 'Created'];
                    const weights = [18, 24, 10, 12, 12, 12, 12]; const totalWeight = weights.reduce((a, b) => a + b, 0); const availableWidth = pageWidth - margin * 2; const colWidths = weights.map(w => Math.floor((w / totalWeight) * availableWidth));
                    const baseLineHeight = 12; const cellPadding = 6; const measureRowHeight = (cells: string[]) => { let maxLines = 1; for (let i = 0; i < cells.length; i++) { const maxW = colWidths[i] - cellPadding; const lines = doc.splitTextToSize(String(cells[i] ?? ''), maxW) as string[]; if (lines.length > maxLines) maxLines = lines.length; } return Math.max(18, maxLines * baseLineHeight + 8); };
                    const drawRow = (cells: string[], isHeader = false) => { let x = margin; doc.setFont('helvetica', isHeader ? 'bold' : 'normal'); doc.setFontSize(isHeader ? 10 : 9); const rowH = measureRowHeight(cells); for (let i = 0; i < cells.length; i++) { const lines = doc.splitTextToSize(String(cells[i] ?? ''), colWidths[i] - cellPadding) as string[]; doc.text(lines, x + 3, y + 12, { baseline: 'alphabetic' }); doc.rect(x, y, colWidths[i], rowH); x += colWidths[i]; } y += rowH; };
                    const headerH = measureRowHeight(headers); if (y + headerH > pageHeight - margin) { doc.addPage(); y = margin; }
                    drawRow(headers, true);
                    for (const u of data) { const cells = [u.name, u.email, u.role, deptName((u as any).department_id), u.position || '', u.phone || '', fmtDate(u.created_at)]; const nextH = measureRowHeight(cells); if (y + nextH > pageHeight - margin) { doc.addPage(); y = margin; drawRow(headers, true); } drawRow(cells); }
                    const fname = `Users_${new Date().toISOString().slice(0, 10)}.pdf`; doc.save(fname);
                  } else {
                    const lines = data.map(u => `${u.name}\t${u.email}\t${u.role}`);
                    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
                    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.setAttribute('download', `users_export_${Date.now()}.txt`); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  }
                  addNotification({ title: 'Export Complete', message: 'Users exported successfully.', type: 'success' });
                } catch (e: any) { addNotification({ title: 'Export Failed', message: e?.message || 'Could not export users.', type: 'error' }); }
                finally { setExporting(false); }
              }} className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 disabled:opacity-50" disabled={exporting}>
                <DownloadIcon className="w-4 h-4 mr-2" /> {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              try {
                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length <= 1) { addToast({ title: 'Import Failed', message: 'CSV appears empty.', type: 'error' }); return; }
                // Support both old and new headers
                const header = lines[0].split(',').map(h => h.trim().replace(/^\"|\"$/g, ''));
                // Try to find both possible header names
                const firstNameIdx = header.findIndex(h => h.toLowerCase().includes('first'));
                const lastNameIdx = header.findIndex(h => h.toLowerCase().includes('last'));
                const emailIdx = header.findIndex(h => h.toLowerCase().includes('email'));
                // Optional: role, department, position, phone
                const roleIdx = header.findIndex(h => h.toLowerCase() === 'role');
                const departmentIdx = header.findIndex(h => h.toLowerCase().includes('department'));
                const positionIdx = header.findIndex(h => h.toLowerCase().includes('position'));
                const phoneIdx = header.findIndex(h => h.toLowerCase().includes('phone'));
                if ([firstNameIdx, lastNameIdx, emailIdx].some(i => i === -1)) {
                  addNotification({ title: 'Import Failed', message: 'CSV missing required headers: First Name, Last Name, Email Address', type: 'error' }); return;
                }
                const parse = (line: string) => { const res: string[] = []; let cur = ''; let q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (ch === '\"') { if (q && line[i + 1] === '\"') { cur += '\"'; i++; } else { q = !q; } } else if (ch === ',' && !q) { res.push(cur); cur = ''; } else { cur += ch; } } res.push(cur); return res.map(s => s.trim()); };
                const rows = lines.slice(1).map(parse);
                let created = 0, failed = 0;
                for (const r of rows) {
                  const get = (i: number) => r[i] ? r[i].replace(/^\"|\"$/g, '') : '';
                  const firstName = get(firstNameIdx);
                  const lastName = get(lastNameIdx);
                  const email = get(emailIdx);
                  if (!firstName || !lastName || !email) continue;
                  const name = `${firstName} ${lastName}`;
                  const password = `${firstName}#`;
                  const role = roleIdx !== -1 ? get(roleIdx) : 'Employee';
                  const department_id = departmentIdx !== -1 ? get(departmentIdx) : 'Employee';
                  const position = positionIdx !== -1 ? get(positionIdx) : '';
                  const phone = phoneIdx !== -1 ? get(phoneIdx) : '';
                  try {
                    const userData: CreateUserData = {
                      email,
                      name,
                      role,
                      department_id,
                      position,
                      phone,
                      password
                    };
                    await userService.create(userData);
                    created++;
                  } catch (err: any) {
                    failed++;
                  }
                }
                // Refresh users list
                const fetchedUsers = await userService.getAll();
                setUsers(fetchedUsers);
                addNotification({ title: 'Import Complete', message: `Imported ${created} users. ${failed ? failed + ' failed.' : ''}`, type: created ? 'success' : 'error' });
              } catch (e: any) { addNotification({ title: 'Import Failed', message: e?.message || 'Could not import CSV.', type: 'error' }); }
              finally { if (importInputRef.current) importInputRef.current.value = ''; }
            }} />
            <button onClick={() => importInputRef.current?.click()} className="px-4 py-2 text-sm font-medium text-secondary bg-lightblue rounded-full shadow-button hover:opacity-90">
              <UploadIcon className="w-4 h-4 mr-2" /> Import
            </button>
          </div>
        </div>
      </div>
      {/* User Statistics */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightred rounded-full">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{users.length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightblue rounded-full">
              <LockIcon className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Administrators</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{users.filter(user => user.role === 'admin').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <BuildingIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Department Officers</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{users.filter(user => user.role === 'manager').length}</p>
            </div>
          </div>
        </div>
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-red-100 rounded-full">
              <UserXIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Suspended Users</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{users.filter(user => !user.is_active).length}</p>
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
                <SearchIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input type="text" className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Search by name, email, or position..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="All">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FilterIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              </div>
              <select className="block w-full pl-10 pr-8 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                <option value="All">All Status</option>
                <option value="Active">Active Only</option>
                <option value="Suspended">Suspended Only</option>
              </select>
            </div>
            <button onClick={() => { setSearchTerm(''); setFilterRole('All'); setFilterDepartment('All'); }} className="px-4 py-2 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90 flex items-center">
              <RefreshCwIcon className="w-4 h-4 mr-2" /> Reset Filters
            </button>
          </div>
        </div>
      </div>
      {/* Users List */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary">All Users</h2>
            <span className="px-3 py-1 text-sm font-medium text-primary bg-lightred rounded-full">{filteredUsers.length} users</span>
          </div>
        </div>
        {selectedUserIds.length > 0 && (
          <div className="mb-2 flex items-center space-x-4">
            <span className="text-sm">{selectedUserIds.length} selected</span>
            <button onClick={handleBulkDeleteUsers} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Delete Selected</button>
          </div>
        )}
        {filteredUsers.length > 0 ? <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-700 dark:text-gray-300">
            <thead className="text-xs text-gray-700 dark:text-gray-300 uppercase bg-lightred dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3"><input type="checkbox" checked={selectedUserIds.length === filteredUsers.length && filteredUsers.length > 0} onChange={e => handleSelectAllUsers(e.target.checked)} /></th>
                <th scope="col" className="px-6 py-3">User</th>
                <th scope="col" className="px-6 py-3">Email</th>
                <th scope="col" className="px-6 py-3">Role</th>
                <th scope="col" className="px-6 py-3">Department</th>
                <th scope="col" className="px-6 py-3">Position</th>
                <th scope="col" className="px-6 py-3">Phone</th>
                <th scope="col" className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(user => <tr key={user.id} className="bg-white dark:bg-gray-900 border-b dark:border-gray-800 hover:bg-lightred/50 dark:hover:bg-gray-800/60">
                <td className="px-4 py-4"><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={e => handleSelectOneUser(user.id, e.target.checked)} /></td>
                <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 mr-3 rounded-full flex items-center justify-center ${!user.is_active ? 'bg-red-100' : 'bg-lightred'}`}>
                      <UserIcon className={`w-6 h-6 ${!user.is_active ? 'text-red-600' : 'text-primary'}`} />
                    </div>
                    <div className="flex flex-col">
                      <span className={!user.is_active ? 'text-gray-500 line-through' : ''}>{user.name}</span>
                      {!user.is_active && <span className="text-[10px] text-red-600 font-bold uppercase tracking-wider">Suspended</span>}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">{user.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadgeClass(user.role)}`}>{formatRoleName(user.role)}</span>
                </td>
                <td className="px-6 py-4">{getDepartmentName(user.department_id)}</td>
                <td className="px-6 py-4">{user.position || 'N/A'}</td>
                <td className="px-6 py-4">{user.phone || 'N/A'}</td>
                <td className="px-6 py-4">
                  <div className="flex space-x-2">
                    <button onClick={() => { setEditingUser(user); setNewUser({ name: user.name, email: user.email, role: user.role, department_id: user.department_id || '', position: user.position || '', phone: user.phone || '', password: '', confirmPassword: '' }); setShowEditUserModal(true); }} className="p-1 text-yellow-600 rounded hover:bg-yellow-100" title="Edit User"><EditIcon className="w-5 h-5" /></button>
                    <button
                      onClick={() => handleToggleUserStatus(user)}
                      className={`p-1 rounded ${!user.is_active ? 'text-green-600 hover:bg-green-100' : 'text-orange-600 hover:bg-orange-100'}`}
                      title={!user.is_active ? "Activate User" : "Suspend User"}
                      disabled={user.role === 'admin'}
                    >
                      {!user.is_active ? <UserCheckIcon className="w-5 h-5" /> : <UserXIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => handleChangePassword(user)} className="p-1 text-blue-600 rounded hover:bg-blue-100" title="Change Password"><LockIcon className="w-5 h-5" /></button>
                    <button onClick={() => { setEditingUser(user); setShowDeleteModal(true); }} className="p-1 text-red-600 rounded hover:bg-red-100" title="Delete User" disabled={user.role === 'admin'}><TrashIcon className="w-5 h-5" style={{ opacity: user.role === 'admin' ? 0.5 : 1 }} /></button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div> : <div className="flex flex-col items-center justify-center py-12">
          {searchTerm || filterRole !== 'All' || filterDepartment !== 'All' ? <>
            <AlertCircleIcon className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-700">No matching users found</h3>
            <p className="mt-2 text-sm text-gray-500">Try adjusting your search or filter criteria</p>
            <button onClick={() => { setSearchTerm(''); setFilterRole('All'); setFilterDepartment('All'); }} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Clear Filters</button>
          </> : <>
            <UserIcon className="w-16 h-16 text-gray-400 dark:text-gray-500" />
            <h3 className="mt-4 text-lg font-medium text-gray-700">No users found</h3>
            <p className="mt-2 text-sm text-gray-500">Get started by adding your first user</p>
            <button onClick={() => setShowAddUserModal(true)} className="px-4 py-2 mt-4 text-sm font-medium text-primary bg-lightred rounded-full shadow-button hover:opacity-90">Add New User</button>
          </>}
        </div>}
      </div>

      {/* Add User Modal */}
      {showAddUserModal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-lg p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-primary">Add New User</h3>
            <button onClick={() => setShowAddUserModal(false)} className="text-gray-500 dark:text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleAddUser}>
            <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <UserIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="John Doe" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MailIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input type="email" className="block w-full pl-10 pr-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="john.doe@example.com" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Role</label>
                <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} required>
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-primary">Parent Department</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingParentDept(!isAddingParentDept)}
                    className="text-xs font-medium text-primary hover:underline flex items-center"
                  >
                    {isAddingParentDept ? (
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
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
                  <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={selectedParentDepartment} onChange={e => { setSelectedParentDepartment(e.target.value); setNewUser({ ...newUser, department_id: '' }); }} required>
                    {departments.filter(d => !d.parent_id).map(root => (
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
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
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
                  <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newUser.department_id || ''} onChange={e => setNewUser({ ...newUser, department_id: e.target.value })} required>
                    <option value="">Select Department</option>
                    {/* Option to assign to root itself */}
                    {departments.filter(d => d.id === selectedParentDepartment).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                    ))}
                    {/* Sub-departments under selected parent */}
                    {departments.filter(d => d.parent_id === selectedParentDepartment).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-primary">Position</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingPosition(!isAddingPosition)}
                    className="text-xs font-medium text-primary hover:underline flex items-center"
                  >
                    {isAddingPosition ? (
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
                    )}
                  </button>
                </div>
                {isAddingPosition ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="New position name"
                      value={newPositionTempName}
                      onChange={e => setNewPositionTempName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreatePosition}
                      disabled={isSavingPosition || !newPositionTempName.trim()}
                      className="p-2 text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                      {isSavingPosition ? (
                        <RefreshCwIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <select
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={newUser.position}
                    onChange={e => setNewUser({ ...newUser, position: e.target.value })}
                    required
                    disabled={activePositions.length === 0}
                  >
                    <option value="">{activePositions.length ? 'Select Position' : 'No active positions available'}</option>
                    {activePositions.map(pos => (
                      <option key={pos.id} value={pos.name}>{pos.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Phone Number</label>
                <input type="tel" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="555-123-4567" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="block w-full px-4 py-2 pr-10 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Minimum 8 characters" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-400 hover:text-primary" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-primary">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} className="block w-full px-4 py-2 pr-10 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="Re-enter password" value={newUser.confirmPassword} onChange={e => setNewUser({ ...newUser, confirmPassword: e.target.value })} required />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 dark:text-gray-400 hover:text-primary" aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}>
                    {showConfirmPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => setShowAddUserModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</button>
              <button type="submit" className="button-primary px-4 py-2 text-sm font-medium">Add User</button>
            </div>
          </form>
        </div>
      </div>}

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-lg p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Edit User
            </h3>
            <button onClick={() => {
              setShowEditUserModal(false);
              setEditingUser(null);
            }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:text-gray-500 dark:hover:text-gray-200">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
          <form onSubmit={handleEditUser}>
            <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <UserIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input type="text" className="block w-full pl-10 pr-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="John Doe" value={newUser.name} onChange={e => setNewUser({
                    ...newUser,
                    name: e.target.value
                  })} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MailIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                  <input type="email" className="block w-full pl-10 pr-3 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="john.doe@example.com" value={newUser.email} onChange={e => setNewUser({
                    ...newUser,
                    email: e.target.value
                  })} required />
                </div>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role
                </label>
                <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newUser.role} onChange={e => setNewUser({
                  ...newUser,
                  role: e.target.value
                })} required>
                  <option value="user">User</option>
                  <option value="manager">
                    Manager
                  </option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Parent Department</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingParentDept(!isAddingParentDept)}
                    className="text-xs font-medium text-primary hover:underline flex items-center"
                  >
                    {isAddingParentDept ? (
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
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
                  <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={selectedParentDepartment} onChange={e => { setSelectedParentDepartment(e.target.value); setNewUser({ ...newUser, department_id: '' }); }} required>
                    {departments.filter(d => !d.parent_id).map(root => (
                      <option key={root.id} value={root.id}>{root.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingDept(!isAddingDept)}
                    className="text-xs font-medium text-primary hover:underline flex items-center"
                  >
                    {isAddingDept ? (
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
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
                  <select className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" value={newUser.department_id || ''} onChange={e => setNewUser({ ...newUser, department_id: e.target.value })} required>
                    <option value="">Select Department</option>
                    {/* Option to assign to root itself */}
                    {departments.filter(d => d.id === selectedParentDepartment).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name} (Root)</option>
                    ))}
                    {/* Sub-departments under selected parent */}
                    {departments.filter(d => d.parent_id === selectedParentDepartment).map(dept => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Position</label>
                  <button
                    type="button"
                    onClick={() => setIsAddingPosition(!isAddingPosition)}
                    className="text-xs font-medium text-primary hover:underline flex items-center"
                  >
                    {isAddingPosition ? (
                      <><XIcon className="w-3 h-3 mr-1" /> Use Existing</>
                    ) : (
                      <><PlusIcon className="w-3 h-3 mr-1" /> Add New</>
                    )}
                  </button>
                </div>
                {isAddingPosition ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="New position name"
                      value={newPositionTempName}
                      onChange={e => setNewPositionTempName(e.target.value)}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreatePosition}
                      disabled={isSavingPosition || !newPositionTempName.trim()}
                      className="p-2 text-white bg-primary rounded-xl hover:opacity-90 disabled:opacity-50"
                    >
                      {isSavingPosition ? (
                        <RefreshCwIcon className="w-5 h-5 animate-spin" />
                      ) : (
                        <CheckIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ) : (
                  <select
                    className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={newUser.position}
                    onChange={e => setNewUser({ ...newUser, position: e.target.value })}
                    required
                  >
                    <option value="">Select Position</option>
                    {allPositions.map(pos => (
                      <option key={pos.id} value={pos.name}>
                        {pos.name}{!pos.is_active ? ' (inactive)' : ''}
                      </option>
                    ))}
                    {!newUser.position || allPositions.some(p => p.name === newUser.position) ? null : (
                      <option value={newUser.position}>{newUser.position}</option>
                    )}
                  </select>
                )}
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Phone Number
                </label>
                <input type="tel" className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="555-123-4567" value={newUser.phone} onChange={e => setNewUser({
                  ...newUser,
                  phone: e.target.value
                })} />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button type="button" onClick={() => {
                setShowEditUserModal(false);
                setEditingUser(null);
              }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary-dark">
                Save Changes
              </button>
            </div>
          </form>
        </div>
      </div>}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && editingUser && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="w-full max-w-lg p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Confirm Deletion
            </h3>
            <button onClick={() => {
              setShowDeleteModal(false);
              setEditingUser(null);
            }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:text-gray-500 dark:hover:text-gray-200">
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300">
              Are you sure you want to delete the user "{editingUser.name}"?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end space-x-2">
            <button onClick={() => {
              setShowDeleteModal(false);
              setEditingUser(null);
            }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
              Cancel
            </button>
            <button onClick={handleDeleteUser} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700" disabled={editingUser.role === 'admin'}>
              Delete User
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
              <h3 className="mt-4 text-lg font-medium text-gray-900">Delete Users</h3>
              <p className="mt-2 text-sm text-gray-500">
                Are you sure you want to delete <b>{selectedUserIds.length}</b> selected user{selectedUserIds.length > 1 ? 's' : ''}? This action cannot be undone.
              </p>
            </div>
            <div className="mt-6 flex space-x-3">
              <button
                onClick={confirmBulkDeleteUsers}
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

      {/* Change Password Modal */}
      {showChangePasswordModal && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Change Password
              </h3>
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setEditingUser(null);
                  setPasswordToChange('');
                  setSearchTerm(''); // Clear search term to show all users
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-4">
                Enter a new password for <strong>{editingUser.name}</strong>
              </p>
              <div className="relative">
                <input
                  type="password"
                  className="block w-full px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                  value={passwordToChange}
                  onChange={(e) => setPasswordToChange(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowChangePasswordModal(false);
                  setEditingUser(null);
                  setPasswordToChange('');
                  setSearchTerm(''); // Clear search term to show all users
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPasswordChange}
                className="button-primary px-4 py-2 text-sm font-medium"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default UserManagement;
