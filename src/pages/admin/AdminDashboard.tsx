import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { MonitorIcon, AlertCircleIcon, UserIcon, BuildingIcon, ArrowRightIcon, CheckCircleIcon, ArchiveIcon, ClockIcon, TicketIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { assetService, issueService, userService, departmentService, assetRequestTypeService } from '../../services/apiDatabase';
import { Asset, Issue, User, Department, AssetRequestType } from '../../lib/supabase';
import AssetImage from '../../components/AssetImage';
const AdminDashboard: React.FC = () => {
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetRequestTypes, setAssetRequestTypes] = useState<AssetRequestType[]>([]);
  const [assetsByDepartment, setAssetsByDepartment] = useState<{ name: string; value: number }[]>([]);
  const [assetsByType, setAssetsByType] = useState<{ name: string; value: number }[]>([]);
  const [assetsByStatus, setAssetsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [issuesByStatus, setIssuesByStatus] = useState<{ name: string; value: number }[]>([]);
  const hasAnnouncedLoaded = useRef(false);
  useEffect(() => {
    // Fetch dashboard data from Supabase
    const fetchData = async () => {
      try {
        const [fAssets, fIssues, fUsers, fDepts, fTypes] = await Promise.all([
          assetService.getAll().catch(err => { console.error('Assets error:', err); return []; }),
          issueService.getAll().catch(err => { console.error('Issues error:', err); return []; }),
          userService.getAll().catch(err => { console.error('Users error:', err); return []; }),
          departmentService.getAll().catch(err => { console.error('Departments error:', err); return []; }),
          assetRequestTypeService.getAll().catch(err => { console.error('Asset Types error:', err); return []; })
        ]);
        setAssets(fAssets);
        setIssues(fIssues);
        setUsers(fUsers);
        setDepartments(fDepts);
        setAssetRequestTypes(fTypes);
        processChartData(fAssets, fIssues, fDepts);
        if (!hasAnnouncedLoaded.current) {
          addToast({
            title: 'Dashboard Loaded',
            message: 'Dashboard data has been loaded successfully.',
            type: 'success',
            duration: 2000
          });
          hasAnnouncedLoaded.current = true;
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        addToast({
          title: 'Error',
          message: `Failed to load dashboard data: ${error.message}`,
          type: 'error',
          duration: 5000
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  const processChartData = (assets: Asset[], issues: Issue[], depts: Department[]) => {
    // Ensure issues is an array
    const safeIssues = Array.isArray(issues) ? issues : [];
    // Assets by department (name mapping)
    const deptIdToName: Record<string, string> = {};
    (depts || []).forEach(d => { deptIdToName[d.id] = d.name; });
    const deptCounts: Record<string, number> = {};
    (assets || []).forEach(asset => {
      const name = asset.department_id ? (deptIdToName[asset.department_id] || 'Unassigned') : 'Unassigned';
      deptCounts[name] = (deptCounts[name] || 0) + 1;
    });
    const deptData = Object.entries(deptCounts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value).slice(0, 5);
    setAssetsByDepartment(deptData);
    // Assets by type
    const typeCounts: Record<string, number> = {};
    (assets || []).forEach(asset => {
      if (asset.type) typeCounts[asset.type] = (typeCounts[asset.type] || 0) + 1;
    });
    const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }))
      .filter(i => i.value > 0).sort((a, b) => b.value - a.value);
    setAssetsByType(typeData);
    // Assets by status
    const statusCounts: Record<string, number> = {};
    (assets || []).forEach(asset => {
      if (asset.status) statusCounts[asset.status] = (statusCounts[asset.status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    setAssetsByStatus(statusData);
    // Issues by status
    const issueStatusCounts: Record<string, number> = {};
    safeIssues.forEach(issue => {
      if (issue.status) issueStatusCounts[issue.status] = (issueStatusCounts[issue.status] || 0) + 1;
    });
    const issueStatusData = Object.entries(issueStatusCounts).map(([name, value]) => ({ name, value }));
    setIssuesByStatus(issueStatusData);
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
      case 'Assigned':
      case 'Resolved':
      case 'Closed':
        return 'bg-lightred text-primary';
      case 'In Maintenance':
      case 'In Progress':
      case 'Pending User Action':
      case 'Pending Parts':
        return 'bg-yellow-100 text-yellow-800';
      case 'Disposed':
      case 'Open':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const getDeptName = (departmentId: string | null) => {
    if (!departmentId) return 'Unassigned';
    const d = (departments || []).find(x => x.id === departmentId);
    return d ? d.name : 'Unknown';
  };
  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unknown';
    const u = (users || []).find(x => x.id === userId);
    return u ? u.name : 'Unknown';
  };
  const getAssetName = (assetId: string | null) => {
    if (!assetId) return 'N/A';
    const a = (assets || []).find(x => x.id === assetId);
    return a ? a.name : 'N/A';
  };
  const getAssetImage = () => {
    // Inline SVG placeholder
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <rect width="64" height="64" fill="#f3f4f6"/>
        <rect x="12" y="16" width="40" height="28" rx="4" fill="#9ca3af"/>
        <rect x="18" y="22" width="28" height="16" rx="2" fill="#e5e7eb"/>
        <rect x="24" y="48" width="16" height="4" rx="2" fill="#9ca3af"/>
      </svg>`
    );
  };
  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];
  const getOpenIssueCount = (issuesList: Issue[]) => {
    const closedStatuses = ['resolved', 'closed', 'completed', 'cancelled', 'canceled'];
    return (issuesList || []).filter(issue => {
      const status = (issue.status || '').toLowerCase();
      return status ? !closedStatuses.includes(status) : true;
    }).length;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading dashboard...</p>
      </div>
    </div>;
  }
  return <div className="space-y-6">
    {/* Admin Dashboard Header */}
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <h1 className="text-3xl font-bold text-primary">Admin Dashboard</h1>
      <p className="mt-2 text-gray-700 dark:text-gray-300">Overview of all assets, issues, and system status.</p>
    </div>
    {/* Quick Actions */}
    <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
      <h2 className="mb-4 text-xl font-bold text-primary">Quick Actions</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Link to="/admin/assets" className="button-primary flex items-center justify-center"> <MonitorIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Manage Assets</span> </Link>
        <Link to="/admin/issues" className="button-primary flex items-center justify-center"> <AlertCircleIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Manage Issues</span> </Link>
        <Link to="/admin/users" className="button-primary flex items-center justify-center"> <UserIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Manage Users</span> </Link>
        <Link to="/admin/departments" className="button-primary flex items-center justify-center"> <BuildingIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Manage Departments</span> </Link>
        <Link to="/admin/asset-requests" className="button-primary flex items-center justify-center"> <TicketIcon className="w-6 h-6 mr-3 text-white" /> <span className="font-medium text-white">Asset Requests</span> </Link>
      </div>
    </div>
    {/* Stats Overview */}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Assets Card */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center">
          <div className="p-3 mr-4 bg-lightblue rounded-full">
            <MonitorIcon className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Total Assets</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{(assets || []).length}</p>
          </div>
        </div>
      </div>
      {/* Open Issues Card */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center">
          <div className="p-3 mr-4 bg-red-100 rounded-full">
            <AlertCircleIcon className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Open Issues</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{getOpenIssueCount(issues)}</p>
          </div>
        </div>
      </div>
      {/* Total Users Card */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center">
          <div className="p-3 mr-4 bg-lightred rounded-full">
            <UserIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Total Users</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{(users || []).length}</p>
          </div>
        </div>
      </div>
      {/* Departments Card */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center">
          <div className="p-3 mr-4 bg-lightblue rounded-full">
            <BuildingIcon className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Departments</p>
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{(departments || []).length}</p>
          </div>
        </div>
      </div>
    </div>
    {/* Asset Status Overview */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Assets by Status */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Assets by Status</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={assetsByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                {assetsByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={value => [`${value} assets`, null]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Assets by Department */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Assets by Department (Top 5)</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={assetsByDepartment} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Assets" fill="#0088FE" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    {/* Issue Status and Asset Types */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Issues by Status */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Issues by Status</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={issuesByStatus} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={80} fill="#8884d8" dataKey="value">
                {issuesByStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={value => [`${value} issues`, null]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      {/* Assets by Type */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Assets by Type</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={assetsByType.slice(0, 8)} margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" name="Count" fill="#00C49F" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    {/* Recent Activity */}
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Recent Issues */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Recent Issues</h2>
          <Link to="/admin/issues" className="button-primary flex items-center text-sm font-medium">View All <ArrowRightIcon className="w-4 h-4 ml-1" /></Link>
        </div>
        <div className="space-y-4">
          {(issues || []).slice(0, 5).map(issue => {
            const asset = assets.find(a => a.id === issue.asset_id);
            const assetType = assetRequestTypes.find(t => t.name === asset?.type);
            return (
              <div key={issue.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-start">
                  <div className="flex-shrink-0 w-12 h-12 mr-4 bg-white dark:bg-gray-700 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600">
                    <AssetImage asset={asset} assetType={assetType} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{issue.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Reported by {getUserName(issue.reported_by)} • {new Date(issue.created_at).toLocaleDateString()}</p>
                    <div className="flex items-center mt-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>{issue.status}</span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 truncate">{getAssetName(issue.asset_id)}</span>
                    </div>
                  </div>
                  <div className={`p-1.5 ml-2 rounded-full ${issue.status === 'Open' ? 'bg-red-100' : issue.status === 'In Progress' ? 'bg-yellow-100' : issue.status === 'Resolved' || issue.status === 'Closed' ? 'bg-lightred' : 'bg-gray-100'}`}>
                    {issue.status === 'Open' ? <AlertCircleIcon className="w-4 h-4 text-red-600" /> : issue.status === 'In Progress' ? <ClockIcon className="w-4 h-4 text-yellow-600" /> : issue.status === 'Resolved' || issue.status === 'Closed' ? <CheckCircleIcon className="w-4 h-4 text-primary" /> : <ArchiveIcon className="w-4 h-4 text-gray-600" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* Recently Added Assets */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">Recently Added Assets</h2>
          <Link to="/admin/assets" className="button-primary flex items-center text-sm font-medium">View All <ArrowRightIcon className="w-4 h-4 ml-1" /></Link>
        </div>
        <div className="space-y-4">
          {(assets || []).slice(0, 5).map(asset => {
            const assetType = assetRequestTypes.find(t => t.name === asset.type);
            return (
              <div key={asset.id} className="flex p-4 bg-lightblue dark:bg-gray-800 rounded-xl">
                <div className="flex-shrink-0 w-16 h-16 mr-4 bg-white dark:bg-gray-700 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600">
                  <AssetImage asset={asset} assetType={assetType} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{asset.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{asset.type} • SN: {asset.serial_number}</p>
                  <div className="flex items-center mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(asset.status)}`}>{asset.status}</span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 truncate">{getDeptName(asset.department_id)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>

  </div>;
};
export default AdminDashboard;
