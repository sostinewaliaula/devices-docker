import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { departmentService, userService, assetService } from '../../services/apiDatabase';
import { Department, User, Asset } from '../../lib/supabase';
import {
  BuildingIcon,
  ArrowLeftIcon,
  UsersIcon,
  PackageIcon,
  PlusIcon,
  UserIcon,
  MailIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  BarChart2Icon,
  DollarSignIcon,
  XCircleIcon,
  EditIcon,
  TrashIcon
} from 'lucide-react';

const DepartmentDetails: React.FC = () => {
  const { id: departmentId } = useParams();
  const { addNotification, addToast } = useNotifications();
  const [department, setDepartment] = useState<Department | null>(null);
  const [departmentUsers, setDepartmentUsers] = useState<User[]>([]);
  const [departmentAssets, setDepartmentAssets] = useState<Asset[]>([]);
  const [departmentManager, setDepartmentManager] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [assetSearchTerm, setAssetSearchTerm] = useState('');

  useEffect(() => {
    const fetchDepartmentData = async () => {
      setLoading(true);
      setNotFound(false);
      try {
        if (!departmentId) return;

        // Fetch department details
        const dept = await departmentService.getById(departmentId);
        if (!dept) {
          setNotFound(true);
          return;
        }
        setDepartment(dept);

        // Fetch department users
        const users = await userService.getByDepartment(departmentId);
        setDepartmentUsers(users);

        // Fetch department assets
        const assets = await assetService.getByDepartment(departmentId);
        setDepartmentAssets(assets);

        // Fetch department manager if exists
        // console.log('Department data:', dept);
        // console.log('Manager ID:', dept.manager_id);
        if (dept.manager_id) {
          try {
            // console.log('Fetching manager with ID:', dept.manager_id);
            const manager = await userService.getById(dept.manager_id);
            // console.log('Manager data:', manager);
            // console.log('Manager user data:', manager?.user);
            setDepartmentManager(manager);
          } catch (error) {
            console.error('Error fetching manager:', error);
            // Manager might not exist, continue without error
          }
        } else {
          // console.log('No manager assigned to this department');
        }

        // Fetch available users and assets for modals (not in this department)
        // console.log('Fetching users/assets not in department:', departmentId);
        const [usersNotInDept, assetsNotInDept] = await Promise.all([
          userService.getNotInDepartment(departmentId),
          assetService.getNotInDepartment(departmentId)
        ]);
        // console.log('Users not in department:', usersNotInDept.length);
        // console.log('Assets not in department:', assetsNotInDept.length);

        setAvailableUsers(usersNotInDept);
        setAvailableAssets(assetsNotInDept);

      } catch (error) {
        setNotFound(true);
        addNotification({
          title: 'Error',
          message: 'Failed to load department details',
          type: 'error'
        });
      } finally {
        setLoading(false);
      }
    };
    fetchDepartmentData();
  }, [departmentId, addNotification]);

  // Helper functions
  const handleAddUserToDepartment = async (userId: string) => {
    setIsUpdating(true);
    try {
      await userService.update(userId, { department_id: departmentId });

      // Refresh data
      const [dept, users, availableUsers] = await Promise.all([
        departmentService.getById(departmentId!),
        userService.getByDepartment(departmentId!),
        userService.getNotInDepartment(departmentId!)
      ]);
      setDepartment(dept);
      setDepartmentUsers(users);
      setAvailableUsers(availableUsers);

      addNotification({
        title: 'Success',
        message: 'User added to department successfully',
        type: 'success'
      });
      addToast({
        title: 'User Added',
        message: 'User has been successfully added to the department',
        type: 'success'
      });
      setShowAddUserModal(false);
      setUserSearchTerm('');
    } catch (error) {
      addNotification({
        title: 'Error',
        message: 'Failed to add user to department',
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddAssetToDepartment = async (assetId: string) => {
    setIsUpdating(true);
    try {
      await assetService.update(assetId, { department_id: departmentId });

      // Refresh data
      const [dept, assets, availableAssets] = await Promise.all([
        departmentService.getById(departmentId!),
        assetService.getByDepartment(departmentId!),
        assetService.getNotInDepartment(departmentId!)
      ]);
      setDepartment(dept);
      setDepartmentAssets(assets);
      setAvailableAssets(availableAssets);

      addNotification({
        title: 'Success',
        message: 'Asset added to department successfully',
        type: 'success'
      });
      addToast({
        title: 'Asset Added',
        message: 'Asset has been successfully added to the department',
        type: 'success'
      });
      setShowAddAssetModal(false);
      setAssetSearchTerm('');
    } catch (error) {
      addNotification({
        title: 'Error',
        message: 'Failed to add asset to department',
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveUserFromDepartment = async (userId: string) => {
    setIsUpdating(true);
    try {
      await userService.update(userId, { department_id: null });

      // Refresh data
      const [dept, users, availableUsers] = await Promise.all([
        departmentService.getById(departmentId!),
        userService.getByDepartment(departmentId!),
        userService.getNotInDepartment(departmentId!)
      ]);
      setDepartment(dept);
      setDepartmentUsers(users);
      setAvailableUsers(availableUsers);

      addNotification({
        title: 'Success',
        message: 'User removed from department successfully',
        type: 'success'
      });
      addToast({
        title: 'User Removed',
        message: 'User has been successfully removed from the department',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        title: 'Error',
        message: 'Failed to remove user from department',
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveAssetFromDepartment = async (assetId: string) => {
    setIsUpdating(true);
    try {
      await assetService.update(assetId, { department_id: null });

      // Refresh data
      const [dept, assets, availableAssets] = await Promise.all([
        departmentService.getById(departmentId!),
        assetService.getByDepartment(departmentId!),
        assetService.getNotInDepartment(departmentId!)
      ]);
      setDepartment(dept);
      setDepartmentAssets(assets);
      setAvailableAssets(availableAssets);

      addNotification({
        title: 'Success',
        message: 'Asset removed from department successfully',
        type: 'success'
      });
      addToast({
        title: 'Asset Removed',
        message: 'Asset has been successfully removed from the department',
        type: 'success'
      });
    } catch (error) {
      addNotification({
        title: 'Error',
        message: 'Failed to remove asset from department',
        type: 'error'
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      Available: 'bg-lightred dark:bg-gray-800 text-primary',
      Assigned: 'bg-lightblue dark:bg-gray-800 text-secondary',
      'In Maintenance': 'bg-yellow-100 dark:bg-gray-800 text-yellow-800 dark:text-yellow-300',
      Reserved: 'bg-lightblue dark:bg-gray-800 text-secondary',
      Disposed: 'bg-red-100 dark:bg-gray-800 text-red-800 dark:text-red-300',
      active: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>{status}</span>;
  };

  const getConditionBadge = (condition: string) => {
    const conditionColors: Record<string, string> = {
      New: 'bg-lightred dark:bg-gray-800 text-primary',
      Excellent: 'bg-lightred dark:bg-gray-800 text-primary',
      Good: 'bg-lightblue dark:bg-gray-800 text-secondary',
      Fair: 'bg-yellow-100 dark:bg-gray-800 text-yellow-800 dark:text-yellow-300',
      Poor: 'bg-orange-100 dark:bg-gray-800 text-orange-800 dark:text-orange-300',
      Defective: 'bg-red-100 dark:bg-gray-800 text-red-800 dark:text-red-300'
    };
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${conditionColors[condition] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}`}>{condition}</span>;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  // Filter functions for search
  const filteredUsers = availableUsers.filter(user =>
    user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
    (user.position && user.position.toLowerCase().includes(userSearchTerm.toLowerCase())) ||
    user.role.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const filteredAssets = availableAssets.filter(asset =>
    asset.name.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
    asset.type.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
    asset.manufacturer.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
    asset.model.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
    asset.serial_number.toLowerCase().includes(assetSearchTerm.toLowerCase()) ||
    (asset.category && asset.category.toLowerCase().includes(assetSearchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading department details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !department) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh]">
        <BuildingIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mb-2" />
        <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-200 mb-2">Department Not Found</h2>
        <p className="text-gray-500 mb-4">The department you are looking for does not exist.</p>
        <Link to="/admin/departments" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center"><ArrowLeftIcon className="w-4 h-4 mr-2" />Back to Departments</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="flex flex-col justify-between p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card md:flex-row md:items-center">
        <div className="flex items-center">
          <Link to="/admin/departments" className="mr-4 text-primary hover:underline flex items-center">
            <ArrowLeftIcon className="w-5 h-5 mr-1" />Back
          </Link>
          <div className="relative">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <BuildingIcon className="w-12 h-12 text-primary" />
            </div>
          </div>
          <div className="ml-4">
            <h1 className="text-2xl font-bold text-primary">{department.name}</h1>
            <div className="flex flex-wrap items-center mt-2 space-x-2">
              <span className="text-sm text-gray-600">{department.location}</span>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span className="text-sm text-gray-600">{departmentUsers.length} Users</span>
              <span className="text-gray-400 dark:text-gray-500">•</span>
              <span className="text-sm text-gray-600">{departmentAssets.length} Assets</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center mt-4 space-y-2 md:mt-0 md:items-end">
          <div className="flex space-x-2">
            <button
              onClick={() => setShowAddUserModal(true)}
              className="button-primary flex items-center px-3 py-1 text-sm font-medium"
            >
              <PlusIcon className="w-4 h-4 mr-1" /> Add User
            </button>
            <button
              onClick={() => setShowAddAssetModal(true)}
              className="px-4 py-2 text-sm font-medium text-secondary border border-secondary rounded-full hover:bg-lightblue dark:bg-gray-800 flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-1" /> Add Asset
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 bg-lightred dark:bg-gray-800 rounded-xl">
              <UsersIcon className="w-8 h-8 text-primary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-primary">{departmentUsers.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 bg-lightblue dark:bg-gray-800 rounded-xl">
              <PackageIcon className="w-8 h-8 text-secondary" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-secondary">{departmentAssets.length}</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 dark:bg-gray-800 rounded-xl">
              <DollarSignIcon className="w-8 h-8 text-yellow-800 dark:text-yellow-300" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Asset Value</p>
              <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
                {(department as any).asset_value || 'KSh 0'}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 dark:bg-gray-800 rounded-xl">
              <BarChart2Icon className="w-8 h-8 text-blue-800 dark:text-blue-300" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Assets</p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                {departmentAssets.filter(asset => asset.status === 'Available' || asset.status === 'Assigned').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Department Details */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <h2 className="mb-4 text-xl font-bold text-primary">Department Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="p-4 bg-lightred dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-center mb-2">
                  <BuildingIcon className="w-5 h-5 mr-2 text-primary dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Description</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{department.description || 'No description available'}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-center mb-2">
                  <MapPinIcon className="w-5 h-5 mr-2 text-primary dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Location</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{department.location}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-center mb-2">
                  <UserIcon className="w-5 h-5 mr-2 text-primary dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Manager</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{departmentManager?.name || department.manager || 'No manager assigned'}</p>
              </div>
              <div className="p-4 bg-lightred dark:bg-gray-800 dark:border dark:border-gray-700 rounded-xl hover:shadow-md dark:hover:shadow-lg transition-shadow duration-200">
                <div className="flex items-center mb-2">
                  <CalendarIcon className="w-5 h-5 mr-2 text-primary dark:text-green-400" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Created</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{formatDate(department.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Department Users */}
          <div className="p-6 mt-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Department Users</h2>
              <button
                onClick={() => setShowAddUserModal(true)}
                className="button-primary flex items-center px-3 py-1 text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Add User
              </button>
            </div>
            {departmentUsers.length > 0 ? (
              <div className="space-y-4">
                {departmentUsers.map(user => (
                  <div key={user.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 dark:text-gray-500 bg-lightred dark:bg-gray-800 rounded-full">
                          <UserIcon className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</h3>
                          <div className="flex items-center mt-1 space-x-4">
                            <div className="flex items-center">
                              <MailIcon className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                              <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{user.email}</p>
                            </div>
                            {user.phone && (
                              <div className="flex items-center">
                                <PhoneIcon className="w-3 h-3 mr-1 text-gray-500 dark:text-gray-400 dark:text-gray-500" />
                                <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{user.phone}</p>
                              </div>
                            )}
                          </div>
                          <div className="mt-1">
                            <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-700 bg-gray-100 dark:bg-gray-200 rounded">
                              {user.role}
                            </span>
                            {user.position && (
                              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{user.position}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveUserFromDepartment(user.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                        disabled={isUpdating}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <UsersIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-gray-600">No users in this department</p>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="mt-4 button-primary px-4 py-2 text-sm font-medium"
                >
                  Add First User
                </button>
              </div>
            )}
          </div>

          {/* Department Assets */}
          <div className="p-6 mt-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary">Department Assets</h2>
              <button
                onClick={() => setShowAddAssetModal(true)}
                className="button-primary flex items-center px-3 py-1 text-sm font-medium"
              >
                <PlusIcon className="w-4 h-4 mr-1" /> Add Asset
              </button>
            </div>
            {departmentAssets.length > 0 ? (
              <div className="space-y-4">
                {departmentAssets.map(asset => (
                  <div key={asset.id} className="p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center">
                        <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 dark:text-gray-500 bg-lightred dark:bg-gray-800 rounded-full">
                          <PackageIcon className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{asset.name}</h3>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-300">{asset.type}</span>
                            <span className="text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">{asset.manufacturer}</span>
                            <span className="text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">SN: {asset.serial_number}</span>
                          </div>
                          <div className="mt-2 flex items-center space-x-2">
                            {getStatusBadge(asset.status)}
                            {getConditionBadge(asset.condition)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/assets/${asset.id}`}
                          className="text-primary hover:text-primary-dark p-1"
                        >
                          <EditIcon className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleRemoveAssetFromDepartment(asset.id)}
                          className="text-red-500 hover:text-red-700 p-1"
                          disabled={isUpdating}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <PackageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500" />
                <p className="mt-2 text-gray-600">No assets in this department</p>
                <button
                  onClick={() => setShowAddAssetModal(true)}
                  className="mt-4 button-primary px-4 py-2 text-sm font-medium"
                >
                  Add First Asset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Side Information */}
        <div>
          {/* Department Manager */}
          {departmentManager ? (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <h2 className="mb-4 text-xl font-bold text-primary">Department Manager</h2>
              <div className="flex items-center p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 dark:text-gray-500 bg-lightred dark:bg-gray-800 rounded-full">
                  <UserIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-800 dark:text-gray-200">{departmentManager.user?.name}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{departmentManager.user?.email}</p>
                  {departmentManager.user?.phone && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{departmentManager.user.phone}</p>
                  )}
                  <div className="mt-1">
                    <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-700 bg-gray-100 dark:bg-gray-200 rounded">
                      {departmentManager.user?.role}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
              <h2 className="mb-4 text-xl font-bold text-primary">Department Manager</h2>
              <div className="flex items-center justify-center p-8 text-center">
                <div>
                  <UserIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-600">No manager assigned</p>
                  <p className="text-sm text-gray-500 mt-1">Assign a manager from the department management page</p>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats */}
          <div className="p-6 mt-6 bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <h2 className="mb-4 text-xl font-bold text-primary">Quick Statistics</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Active Users</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {departmentUsers.filter(u => u.is_active).length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Available Assets</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {departmentAssets.filter(a => a.status === 'Available').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Assigned Assets</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {departmentAssets.filter(a => a.status === 'Assigned').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">In Maintenance</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {departmentAssets.filter(a => a.status === 'In Maintenance').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-primary">Add User to Department</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setUserSearchTerm('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:text-gray-500 dark:hover:text-gray-200"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Search Input */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search users by name, email, role, or position..."
                    className="w-full px-4 py-3 pl-10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 transition-all"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {userSearchTerm && (
                  <p className="mt-2 text-sm text-gray-600">
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>

              {availableUsers.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center">
                        <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 dark:text-gray-500 bg-lightred dark:bg-gray-800 rounded-full">
                          <UserIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{user.name}</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-300 dark:text-gray-300">{user.email}</p>
                          <span className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-700 bg-gray-100 dark:bg-gray-200 rounded">
                            {user.role}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddUserToDepartment(user.id)}
                        className="button-primary px-3 py-1 text-sm font-medium"
                        disabled={isUpdating}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <UsersIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto" />
                  <p className="mt-2 text-gray-600">
                    {userSearchTerm ? 'No users found matching your search' : 'No available users to add'}
                  </p>
                  {userSearchTerm && (
                    <button
                      onClick={() => setUserSearchTerm('')}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-card">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xl font-bold text-primary">Add Asset to Department</h3>
              <button
                onClick={() => {
                  setShowAddAssetModal(false);
                  setAssetSearchTerm('');
                }}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:text-gray-500 dark:hover:text-gray-200"
              >
                <XCircleIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              {/* Search Input */}
              <div className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search assets by name, type, manufacturer, model, serial number, or category..."
                    className="w-full px-4 py-3 pl-10 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-white dark:bg-gray-800 transition-all"
                    value={assetSearchTerm}
                    onChange={(e) => setAssetSearchTerm(e.target.value)}
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-5 w-5 text-gray-400 dark:text-gray-500 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                {assetSearchTerm && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} found
                  </p>
                )}
              </div>

              {availableAssets.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredAssets.map(asset => (
                    <div key={asset.id} className="flex items-center justify-between p-4 bg-lightred dark:bg-gray-800 rounded-xl">
                      <div className="flex items-center">
                        <div className="p-2 mr-4 text-gray-400 dark:text-gray-500 dark:text-gray-500 bg-lightred dark:bg-gray-800 rounded-full">
                          <PackageIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200">{asset.name}</h4>
                          <div className="flex items-center mt-1 space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-300">{asset.type}</span>
                            <span className="text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">{asset.manufacturer}</span>
                            <span className="text-gray-400 dark:text-gray-500">•</span>
                            <span className="text-xs text-gray-600 dark:text-gray-300">SN: {asset.serial_number}</span>
                          </div>
                          <div className="mt-2 flex items-center space-x-2">
                            {getStatusBadge(asset.status)}
                            {getConditionBadge(asset.condition)}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddAssetToDepartment(asset.id)}
                        className="button-primary px-3 py-1 text-sm font-medium"
                        disabled={isUpdating}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <PackageIcon className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto" />
                  <p className="mt-2 text-gray-600 dark:text-gray-300">
                    {assetSearchTerm ? 'No assets found matching your search' : 'No available assets to add'}
                  </p>
                  {assetSearchTerm && (
                    <button
                      onClick={() => setAssetSearchTerm('')}
                      className="mt-2 text-sm text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentDetails;

