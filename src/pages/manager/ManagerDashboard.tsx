import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContextNew';
import { useNotifications } from '../../contexts/NotificationContext';
import { 
  MonitorIcon, 
  AlertCircleIcon, 
  UserIcon, 
  BuildingIcon, 
  ArrowRightIcon, 
  CheckCircleIcon, 
  ArchiveIcon, 
  ClockIcon, 
  TicketIcon,
  MessageSquareIcon,
  UsersIcon,
  TrendingUpIcon
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { assetService, issueService, userService, departmentService, assetRequestsService } from '../../services/apiDatabase';
import { Asset, Issue, User, Department, AssetRequest } from '../../lib/supabase';

const ManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useNotifications();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [department, setDepartment] = useState<Department | null>(null);
  const [assetRequests, setAssetRequests] = useState<AssetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsByStatus, setAssetsByStatus] = useState<{ name: string; value: number }[]>([]);
  const [issuesByStatus, setIssuesByStatus] = useState<{ name: string; value: number }[]>([]);
  const [requestsByStatus, setRequestsByStatus] = useState<{ name: string; value: number }[]>([]);
  const hasAnnouncedLoaded = useRef(false);

  useEffect(() => {
    if (!user?.department_id) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [fAssets, fIssues, fTeamMembers, fDepartment, fRequests] = await Promise.all([
          assetService.getByDepartment(user.department_id!).catch(err => { console.error('Assets error:', err); return []; }),
          issueService.getAll().catch(err => { console.error('Issues error:', err); return []; }),
          userService.getByDepartment(user.department_id!).catch(err => { console.error('Team members error:', err); return []; }),
          departmentService.getById(user.department_id!).catch(err => { console.error('Department error:', err); return null; }),
          assetRequestsService.getAll().catch(err => { console.error('Asset requests error:', err); return []; })
        ]);

        // Filter issues for department members
        const departmentMemberIds = fTeamMembers.map(member => member.id);
        const departmentIssues = fIssues.filter(issue => 
          departmentMemberIds.includes(issue.reported_by) || 
          (issue.asset_id && fAssets.some(asset => asset.id === issue.asset_id))
        );

        // Filter asset requests for department members
        const departmentRequests = fRequests.filter(request => 
          departmentMemberIds.includes(request.requested_by)
        );

        setAssets(fAssets);
        setIssues(departmentIssues);
        setTeamMembers(fTeamMembers);
        setDepartment(fDepartment);
        setAssetRequests(departmentRequests);
        processChartData(fAssets, departmentIssues, departmentRequests);

        if (!hasAnnouncedLoaded.current) {
          addToast({
            title: 'Dashboard Loaded',
            message: 'Department dashboard data has been loaded successfully.',
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
  }, [user?.department_id]);

  const processChartData = (assets: Asset[], issues: Issue[], requests: AssetRequest[]) => {
    // Assets by status
    const statusCounts: Record<string, number> = {};
    assets.forEach(asset => {
      if (asset.status) statusCounts[asset.status] = (statusCounts[asset.status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
    setAssetsByStatus(statusData);

    // Issues by status
    const issueStatusCounts: Record<string, number> = {};
    issues.forEach(issue => {
      if (issue.status) issueStatusCounts[issue.status] = (issueStatusCounts[issue.status] || 0) + 1;
    });
    const issueStatusData = Object.entries(issueStatusCounts).map(([name, value]) => ({ name, value }));
    setIssuesByStatus(issueStatusData);

    // Asset requests by status
    const requestStatusCounts: Record<string, number> = {};
    requests.forEach(request => {
      if (request.status) requestStatusCounts[request.status] = (requestStatusCounts[request.status] || 0) + 1;
    });
    const requestStatusData = Object.entries(requestStatusCounts).map(([name, value]) => ({ name, value }));
    setRequestsByStatus(requestStatusData);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available':
      case 'Assigned':
      case 'Resolved':
      case 'Closed':
      case 'Approved':
        return 'bg-lightred text-primary';
      case 'In Maintenance':
      case 'In Progress':
      case 'Pending User Action':
      case 'Pending Parts':
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Disposed':
      case 'Open':
      case 'Rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user?.department_id) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <BuildingIcon className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-600 mb-2">No Department Assigned</h2>
          <p className="text-gray-500">Please contact your administrator to assign you to a department.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Department Manager Dashboard Header */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h1 className="text-3xl font-bold text-primary">Department Manager Dashboard</h1>
        <p className="mt-2 text-gray-700 dark:text-gray-300">
          Managing {department?.name || 'your department'} - {teamMembers.length} team members
        </p>
      </div>

      {/* Quick Actions */}
      <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
        <h2 className="mb-4 text-xl font-bold text-primary">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link to="/manager/team" className="button-primary flex items-center justify-center">
            <UsersIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Team Members</span>
          </Link>
          <Link to="/manager/issues" className="button-primary flex items-center justify-center">
            <AlertCircleIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Department Issues</span>
          </Link>
          <Link to="/manager/assets" className="button-primary flex items-center justify-center">
            <MonitorIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Department Assets</span>
          </Link>
          <Link to="/manager/asset-requests" className="button-primary flex items-center justify-center">
            <TicketIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Asset Requests</span>
          </Link>
          <Link to="/manager/communication" className="button-primary flex items-center justify-center">
            <MessageSquareIcon className="w-6 h-6 mr-3 text-white" />
            <span className="font-medium text-white">Team Communication</span>
          </Link>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Department Assets Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightblue rounded-full">
              <MonitorIcon className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Department Assets</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{assets.length}</p>
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
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                {issues.filter(issue => issue.status === 'Open').length}
              </p>
            </div>
          </div>
        </div>

        {/* Team Members Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-lightred rounded-full">
              <UserIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Team Members</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">{teamMembers.length}</p>
            </div>
          </div>
        </div>

        {/* Pending Requests Card */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 mr-4 bg-yellow-100 rounded-full">
              <TicketIcon className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">Pending Requests</p>
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                {assetRequests.filter(req => req.status === 'Pending').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Assets by Status */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <h2 className="mb-4 text-xl font-bold text-primary">Department Assets by Status</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={assetsByStatus} 
                  cx="50%" 
                  cy="50%" 
                  labelLine={false} 
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} 
                  outerRadius={80} 
                  fill="#8884d8" 
                  dataKey="value"
                >
                  {assetsByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => [`${value} assets`, null]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issues by Status */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <h2 className="mb-4 text-xl font-bold text-primary">Department Issues by Status</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={issuesByStatus} 
                  cx="50%" 
                  cy="50%" 
                  labelLine={false} 
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} 
                  outerRadius={80} 
                  fill="#8884d8" 
                  dataKey="value"
                >
                  {issuesByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={value => [`${value} issues`, null]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Issues */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary">Recent Department Issues</h2>
            <Link to="/manager/issues" className="button-primary flex items-center text-sm font-medium">
              View All <ArrowRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-4">
            {issues.slice(0, 5).map(issue => (
              <div key={issue.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="flex items-start">
                  <div className={`p-2 mr-4 rounded-full ${
                    issue.status === 'Open' ? 'bg-red-100' : 
                    issue.status === 'In Progress' ? 'bg-yellow-100' : 
                    issue.status === 'Resolved' || issue.status === 'Closed' ? 'bg-lightred' : 'bg-gray-100'
                  }`}>
                    {issue.status === 'Open' ? <AlertCircleIcon className="w-5 h-5 text-red-600" /> : 
                     issue.status === 'In Progress' ? <ClockIcon className="w-5 h-5 text-yellow-600" /> : 
                     issue.status === 'Resolved' || issue.status === 'Closed' ? <CheckCircleIcon className="w-5 h-5 text-primary" /> : 
                     <ArchiveIcon className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{issue.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Reported by {getUserName(issue.reported_by)} • {new Date(issue.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(issue.status)}`}>
                        {issue.status}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {getAssetName(issue.asset_id)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Asset Requests */}
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-primary">Recent Asset Requests</h2>
            <Link to="/manager/asset-requests" className="button-primary flex items-center text-sm font-medium">
              View All <ArrowRightIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="space-y-4">
            {assetRequests.slice(0, 5).map(request => (
              <div key={request.id} className="p-4 bg-lightblue dark:bg-gray-800 rounded-xl">
                <div className="flex items-start">
                  <div className={`p-2 mr-4 rounded-full ${
                    request.status === 'Pending' ? 'bg-yellow-100' : 
                    request.status === 'Approved' ? 'bg-lightred' : 
                    request.status === 'Rejected' ? 'bg-red-100' : 'bg-gray-100'
                  }`}>
                    {request.status === 'Pending' ? <ClockIcon className="w-5 h-5 text-yellow-600" /> : 
                     request.status === 'Approved' ? <CheckCircleIcon className="w-5 h-5 text-primary" /> : 
                     request.status === 'Rejected' ? <AlertCircleIcon className="w-5 h-5 text-red-600" /> : 
                     <ArchiveIcon className="w-5 h-5 text-gray-600" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{request.asset_type}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Requested by {getUserName(request.requested_by)} • {new Date(request.created_at).toLocaleDateString()}
                    </p>
                    <div className="flex items-center mt-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(request.status)}`}>
                        {request.status}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        Priority: {request.priority || 'Medium'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
