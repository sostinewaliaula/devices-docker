// New API-based database service to replace Supabase services
import api from './apiService';
import { Asset, Department, User, Issue, IssueComment, AssetMaintenance, NotificationRecord, AuditLog, AssetRequest, Position, AssetHistoryPayload, AssetHistoryEntry, AssetHistorySummary, UserHistorySummary, UserHistoryDetail, AssetRequestType, IssueCategory, AssetType, DropdownOption } from '../lib/supabase';

const normalizeIssue = (issue: any): Issue => {
  if (!issue) return issue;
  return {
    ...issue,
    estimated_cost: issue.estimated_cost === null || issue.estimated_cost === undefined
      ? null
      : Number(issue.estimated_cost)
  };
};

const normalizeIssueList = (payload: any): Issue[] => {
  const list = payload?.issues ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeIssue);
};

const extractIssue = (payload: any): Issue | null => {
  const issue = payload?.issue ?? payload ?? null;
  return issue ? normalizeIssue(issue) : null;
};

const normalizeAssetRequest = (request: any): AssetRequest => {
  if (!request) return request;
  return {
    ...request,
    estimated_cost: request.estimated_cost === null || request.estimated_cost === undefined
      ? null
      : Number(request.estimated_cost)
  };
};

const normalizeAssetRequestList = (payload: any): AssetRequest[] => {
  const list = payload?.asset_requests ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeAssetRequest);
};

const extractAssetRequest = (payload: any): AssetRequest | null => {
  const request = payload?.asset_request ?? payload ?? null;
  return request ? normalizeAssetRequest(request) : null;
};

const normalizePosition = (item: any): Position => {
  if (!item) return item;
  return {
    ...item,
    is_active: !!item.is_active
  };
};

const normalizePositionList = (payload: any): Position[] => {
  const list = payload?.positions ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizePosition);
};

const extractPosition = (payload: any): Position | null => {
  const item = payload?.position ?? payload ?? null;
  return item ? normalizePosition(item) : null;
};

const normalizeAssetRequestType = (item: any): AssetRequestType => {
  if (!item) return item;
  return {
    ...item,
    is_active: !!item.is_active
  };
};

const normalizeAssetRequestTypeList = (payload: any): AssetRequestType[] => {
  const list = payload?.types ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeAssetRequestType);
};

const extractAssetRequestType = (payload: any): AssetRequestType | null => {
  const item = payload?.type ?? payload ?? null;
  return item ? normalizeAssetRequestType(item) : null;
};

const normalizeAssetType = (item: any): AssetType => {
  if (!item) return item;
  let parsedSchema = [];
  try {
    parsedSchema = typeof item.parameters_schema === 'string' ? JSON.parse(item.parameters_schema) : (item.parameters_schema || []);
  } catch(e) {}
  
  return {
    ...item,
    is_active: !!item.is_active,
    parameters_schema: parsedSchema
  };
};

const normalizeAssetTypeList = (payload: any): AssetType[] => {
  const list = payload?.types ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeAssetType);
};

const extractAssetType = (payload: any): AssetType | null => {
  const item = payload?.type ?? payload ?? null;
  return item ? normalizeAssetType(item) : null;
};

const normalizeIssueCategory = (item: any): IssueCategory => {
  if (!item) return item;
  return {
    ...item,
    is_active: !!item.is_active
  };
};

const normalizeIssueCategoryList = (payload: any): IssueCategory[] => {
  const list = payload?.categories ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeIssueCategory);
};

const extractIssueCategory = (payload: any): IssueCategory | null => {
  const item = payload?.category ?? payload ?? null;
  return item ? normalizeIssueCategory(item) : null;
};

const normalizeDropdownOption = (item: any): DropdownOption => {
  if (!item) return item;
  return {
    ...item,
    is_active: !!item.is_active
  };
};

const normalizeDropdownOptionList = (payload: any): DropdownOption[] => {
  const list = payload?.options ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeDropdownOption);
};

const extractDropdownOption = (payload: any): DropdownOption | null => {
  const item = payload?.option ?? payload ?? null;
  return item ? normalizeDropdownOption(item) : null;
};

const normalizeUser = (user: any): User => {
  if (!user) return user;
  return {
    ...user,
    is_active: user.is_active === true || user.is_active === 1 || user.is_active === '1'
  };
};

const normalizeUserList = (payload: any): User[] => {
  const list = payload?.users ?? payload ?? [];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.map(normalizeUser);
};

const extractUser = (payload: any): User | null => {
  const user = payload?.user ?? payload ?? null;
  return user ? normalizeUser(user) : null;
};

// Department operations
export const departmentService = {
  async getAll(): Promise<Department[]> {
    const response = await api.get('/departments');
    return response.data?.departments || response.data || [];
  },

  async getById(id: string): Promise<Department | null> {
    const response = await api.get(`/departments/${id}`);
    return response.data?.department || response.data || null;
  },

  async create(data: Partial<Department>): Promise<Department> {
    const response = await api.post('/departments', data);
    return response.data;
  },

  async update(id: string, data: Partial<Department>): Promise<Department> {
    const response = await api.put(`/departments/${id}`, data);
    return response.data?.department || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`);
  }
};

// User operations
export const userService = {
  async getAll(): Promise<User[]> {
    const response = await api.get('/users');
    return normalizeUserList(response.data);
  },

  async getById(id: string): Promise<User | null> {
    const response = await api.get(`/users/${id}`);
    return extractUser(response.data);
  },

  async getByDepartment(departmentId: string): Promise<User[]> {
    const response = await api.get(`/users?department_id=${departmentId}`);
    return normalizeUserList(response.data);
  },

  async getNotInDepartment(departmentId: string): Promise<User[]> {
    const response = await api.get(`/users?notInDepartment=${departmentId}`);
    return normalizeUserList(response.data);
  },

  async getByRoles(roles: string[]): Promise<User[]> {
    const response = await api.get(`/users?roles=${roles.join(',')}`);
    return normalizeUserList(response.data);
  },

  async create(data: Partial<User>): Promise<User> {
    const response = await api.post('/users', data);
    return extractUser(response.data) as User;
  },

  async update(id: string, data: Partial<User>): Promise<User> {
    const response = await api.put(`/users/${id}`, data);
    return extractUser(response.data) as User;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  async changePassword(id: string, newPassword: string): Promise<void> {
    await api.put(`/users/${id}/password`, { newPassword });
  },

  async getHistorySummary(params?: {
    search?: string;
    role?: string;
    department_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{ users: UserHistorySummary[]; pagination: any }> {
    const response = await api.get('/users/history', { params });
    return response.data || { users: [], pagination: {} };
  },

  async getHistoryDetail(id: string): Promise<UserHistoryDetail> {
    const response = await api.get(`/users/${id}/history`);
    return response.data;
  }
};

// Asset operations
export const assetService = {
  async getAll(): Promise<Asset[]> {
    const response = await api.get('/assets');
    return response.data?.assets || response.data || [];
  },

  async getById(id: string): Promise<Asset | null> {
    const response = await api.get(`/assets/${id}`);
    return response.data?.asset || response.data || null;
  },

  async getByDepartment(departmentId: string): Promise<Asset[]> {
    const response = await api.get(`/assets?department_id=${departmentId}`);
    return response.data?.assets || response.data || [];
  },

  async getNotInDepartment(departmentId: string): Promise<Asset[]> {
    // console.log('API: Getting assets not in department:', departmentId);
    const response = await api.get(`/assets?notInDepartment=${departmentId}`);
    // console.log('API: Assets response:', response.data);
    return response.data?.assets || response.data || [];
  },

  async create(data: Partial<Asset> | FormData): Promise<Asset> {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {};
    const response = await api.post('/assets', data, config);
    return response.data;
  },

  async update(id: string, data: Partial<Asset> | FormData): Promise<Asset> {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {};
    const response = await api.put(`/assets/${id}`, data, config);
    return response.data?.asset || response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/assets/${id}`);
  },

  async getByAssignedUser(userId: string, limit: number = 50): Promise<Asset[]> {
    const response = await api.get(`/assets?assigned_to=${userId}&limit=${limit}`);
    return response.data?.assets || response.data || [];
  },

  async getHistory(id: string): Promise<AssetHistoryPayload> {
    const response = await api.get(`/assets/${id}/history`);
    return response.data as AssetHistoryPayload;
  },

  async getHistoryEntries(params?: {
    asset_id?: string;
    owner_id?: string;
    entry_type?: string;
    event_type?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    limit?: number;
  }): Promise<{ entries: AssetHistoryEntry[]; pagination: any }> {
    const response = await api.get('/assets/history', { params });
    return response.data || { entries: [], pagination: {} };
  },

  async getHistorySummary(params?: {
    search?: string;
    status?: string;
    type?: string;
    department_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{ assets: AssetHistorySummary[]; pagination: any }> {
    const response = await api.get('/assets/history/summary', { params });
    return response.data || { assets: [], pagination: {} };
  }
};

// Issue operations
export const issueService = {
  async getAll(): Promise<Issue[]> {
    const response = await api.get('/issues');
    return normalizeIssueList(response.data);
  },

  async getById(id: string): Promise<Issue | null> {
    const response = await api.get(`/issues/${id}`);
    console.log('API Service getById response.data:', response.data);
    return extractIssue(response.data);
  },

  async getByAssetId(assetId: string): Promise<Issue[]> {
    const response = await api.get(`/issues?asset_id=${assetId}`);
    return normalizeIssueList(response.data);
  },

  async create(data: Partial<Issue> | FormData): Promise<Issue> {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {};

    // When sending FormData with axios, we need to let the browser set the Content-Type
    // to include the boundary. However, our axios instance has 'application/json' default.
    // We try to override it. Note: 'multipart/form-data' without boundary might fail.
    // If this fails, we should try setting it to undefined/null.
    const response = await api.post('/issues', data, config);
    return extractIssue(response.data) as Issue;
  },

  async update(id: string, data: Partial<Issue>): Promise<Issue> {
    const response = await api.put(`/issues/${id}`, data);
    return extractIssue(response.data) as Issue;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/issues/${id}`);
  },

  async getByReporter(userId: string, limit: number = 50): Promise<Issue[]> {
    const response = await api.get(`/issues?reported_by=${userId}&limit=${limit}`);
    return normalizeIssueList(response.data);
  }
};

// Issue Comment operations
export const commentService = {
  async getByIssueId(issueId: string): Promise<IssueComment[]> {
    const response = await api.get(`/issues/${issueId}/comments`);
    return response.data || [];
  },

  async create(issueId: string, content: string): Promise<IssueComment> {
    const response = await api.post(`/issues/${issueId}/comments`, { content });
    return response.data;
  },

  async update(issueId: string, commentId: string, content: string): Promise<IssueComment> {
    const response = await api.put(`/issues/${issueId}/comments/${commentId}`, { content });
    return response.data;
  },

  async delete(issueId: string, commentId: string): Promise<void> {
    await api.delete(`/issues/${issueId}/comments/${commentId}`);
  }
};

// Notification operations
export const notificationService = {
  async getForUser(_userId: string, limit: number = 50): Promise<NotificationRecord[]> {
    const response = await api.get(`/notifications?limit=${limit}&offset=0`);
    return response.data?.data?.notifications || [];
  },

  async markAsRead(id: string): Promise<void> {
    await api.put(`/notifications/${id}/read`);
  },

  async markAllAsRead(_userId: string): Promise<void> {
    await api.put('/notifications/mark-all-read');
  },

  async getUnreadCount(): Promise<number> {
    const response = await api.get('/notifications/unread-count');
    return response.data?.data?.unreadCount || 0;
  },

  async notifyUser(_userId: string, _title: string, _message: string, _type: 'info' | 'success' | 'error' | 'warning' = 'info'): Promise<void> {
    // Notifications are created by backend services, not by frontend
    console.warn('notifyUser called from frontend - notifications should be created by backend services');
  }
};

// Asset Request operations
export const assetRequestsService = {
  async getAll(): Promise<AssetRequest[]> {
    const response = await api.get('/asset-requests');
    return normalizeAssetRequestList(response.data);
  },

  async getByUserId(userId: string): Promise<AssetRequest[]> {
    const response = await api.get(`/asset-requests?userId=${userId}`);
    return normalizeAssetRequestList(response.data);
  },

  async create(data: Partial<AssetRequest>): Promise<AssetRequest> {
    const response = await api.post('/asset-requests', data);
    return extractAssetRequest(response.data) as AssetRequest;
  },

  async update(id: string, data: Partial<AssetRequest>): Promise<AssetRequest> {
    const response = await api.put(`/asset-requests/${id}`, data);
    return extractAssetRequest(response.data) as AssetRequest;
  },

  async updateUser(id: string, data: Partial<AssetRequest>): Promise<AssetRequest> {
    const response = await api.put(`/asset-requests/${id}/user`, data);
    return extractAssetRequest(response.data) as AssetRequest;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/asset-requests/${id}`);
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/asset-requests/${id}/user`);
  }
};

// Positions operations
export const positionService = {
  async getAll(includeInactive = false): Promise<Position[]> {
    const query = includeInactive ? '?includeInactive=true' : '';
    const response = await api.get(`/positions${query}`);
    return normalizePositionList(response.data);
  },

  async create(data: { name: string; description?: string; is_active?: boolean }): Promise<Position> {
    const response = await api.post('/positions', data);
    return extractPosition(response.data) as Position;
  },

  async update(id: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<Position> {
    const response = await api.put(`/positions/${id}`, data);
    return extractPosition(response.data) as Position;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/positions/${id}`);
  }
};

export const assetTypeService = {
  async getAll(includeInactive = false, search?: string): Promise<AssetType[]> {
    const queryParts: string[] = [];
    if (includeInactive) queryParts.push('includeInactive=true');
    if (search) queryParts.push(`search=${encodeURIComponent(search)}`);
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    const response = await api.get(`/asset-types${query}`);
    return normalizeAssetTypeList(response.data);
  },

  async create(data: Partial<AssetType>): Promise<AssetType> {
    const response = await api.post('/asset-types', data);
    return extractAssetType(response.data) as AssetType;
  },

  async update(id: string, data: Partial<AssetType>): Promise<AssetType> {
    const response = await api.put(`/asset-types/${id}`, data);
    return extractAssetType(response.data) as AssetType;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/asset-types/${id}`);
  }
};

export const assetRequestTypeService = {
  async getAll(includeInactive = false, search?: string): Promise<AssetRequestType[]> {
    const queryParts: string[] = [];
    if (includeInactive) {
      queryParts.push('includeInactive=true');
    }
    if (search) {
      queryParts.push(`search=${encodeURIComponent(search)}`);
    }
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    const response = await api.get(`/asset-request-types${query}`);
    return normalizeAssetRequestTypeList(response.data);
  },

  async create(data: { name: string; description?: string; is_active?: boolean } | FormData): Promise<AssetRequestType> {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {};
    const response = await api.post('/asset-request-types', data, config);
    return extractAssetRequestType(response.data) as AssetRequestType;
  },

  async update(id: string, data: { name?: string; description?: string; is_active?: boolean } | FormData): Promise<AssetRequestType> {
    const config = data instanceof FormData
      ? { headers: { 'Content-Type': undefined } }
      : {};
    const response = await api.put(`/asset-request-types/${id}`, data, config);
    return extractAssetRequestType(response.data) as AssetRequestType;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/asset-request-types/${id}`);
  }
};

export const dropdownOptionsService = {
  async getAll(type?: string, includeInactive = false): Promise<DropdownOption[]> {
    const queryParts: string[] = [];
    if (type) queryParts.push(`type=${type}`);
    if (includeInactive) queryParts.push('includeInactive=true');
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    const response = await api.get(`/dropdown-options${query}`);
    return normalizeDropdownOptionList(response.data);
  },

  async create(data: { type: string; value: string; is_active?: boolean }): Promise<DropdownOption> {
    const response = await api.post('/dropdown-options', data);
    return extractDropdownOption(response.data) as DropdownOption;
  },

  async update(id: number, data: { type?: string; value?: string; is_active?: boolean }): Promise<DropdownOption> {
    const response = await api.put(`/dropdown-options/${id}`, data);
    return extractDropdownOption(response.data) as DropdownOption;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/dropdown-options/${id}`);
  }
};

export const issueCategoryService = {
  async getAll(includeInactive = false, search?: string): Promise<IssueCategory[]> {
    const queryParts: string[] = [];
    if (includeInactive) {
      queryParts.push('includeInactive=true');
    }
    if (search) {
      queryParts.push(`search=${encodeURIComponent(search)}`);
    }
    const query = queryParts.length ? `?${queryParts.join('&')}` : '';
    const response = await api.get(`/issue-categories${query}`);
    return normalizeIssueCategoryList(response.data);
  },

  async create(data: { name: string; description?: string; is_active?: boolean }): Promise<IssueCategory> {
    const response = await api.post('/issue-categories', data);
    return extractIssueCategory(response.data) as IssueCategory;
  },

  async update(id: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<IssueCategory> {
    const response = await api.put(`/issue-categories/${id}`, data);
    return extractIssueCategory(response.data) as IssueCategory;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/issue-categories/${id}`);
  }
};

// Audit operations
export const auditService = {
  async getAll(params?: {
    page?: number;
    limit?: number;
    user_id?: string;
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ audit_logs: AuditLog[]; pagination: any }> {
    const response = await api.get('/audit', { params });
    return response.data || { audit_logs: [], pagination: {} };
  },

  async getById(id: string): Promise<AuditLog> {
    const response = await api.get(`/audit/${id}`);
    return response.data.audit_log;
  },

  async getByUserId(userId: string, params?: { page?: number; limit?: number }): Promise<{ audit_logs: AuditLog[]; pagination: any }> {
    const response = await api.get(`/audit/user/${userId}`, { params });
    return response.data || { audit_logs: [], pagination: {} };
  },

  async getStats(params?: { start_date?: string; end_date?: string }): Promise<any> {
    const response = await api.get('/audit/stats/summary', { params });
    return response.data.statistics || {};
  },

  async write(data: Partial<AuditLog>): Promise<AuditLog> {
    const response = await api.post('/audit', data);
    return response.data;
  },

  async list(limit: number = 1000): Promise<AuditLog[]> {
    // Legacy method for backward compatibility
    const response = await this.getAll({ limit });
    return response.audit_logs || [];
  }
};

// Asset Maintenance operations
export const maintenanceService = {
  async getByAssetId(assetId: string): Promise<AssetMaintenance[]> {
    const response = await api.get(`/assets/${assetId}/maintenance`);
    return response.data || [];
  },

  async create(data: Partial<AssetMaintenance>): Promise<AssetMaintenance> {
    const response = await api.post('/asset-maintenance', data);
    return response.data;
  },

  async update(id: string, data: Partial<AssetMaintenance>): Promise<AssetMaintenance> {
    const response = await api.put(`/asset-maintenance/${id}`, data);
    return response.data;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/asset-maintenance/${id}`);
  }
};

// Manager operations
export const managerService = {
  async getDashboard(): Promise<any> {
    const response = await api.get('/manager/dashboard');
    return response.data;
  },

  async getTeamMembers(search?: string, role?: string): Promise<User[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (role) params.append('role', role);

    const response = await api.get(`/manager/team?${params.toString()}`);
    return response.data?.teamMembers || [];
  },

  async getDepartmentIssues(search?: string, status?: string, priority?: string): Promise<Issue[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);

    const response = await api.get(`/manager/issues?${params.toString()}`);
    return response.data?.issues || [];
  },

  async getDepartmentAssets(search?: string, status?: string, type?: string): Promise<Asset[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (type) params.append('type', type);

    const response = await api.get(`/manager/assets?${params.toString()}`);
    return response.data?.assets || [];
  },

  async getDepartmentAssetRequests(search?: string, status?: string, priority?: string): Promise<AssetRequest[]> {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (priority) params.append('priority', priority);

    const response = await api.get(`/manager/asset-requests?${params.toString()}`);
    return response.data?.asset_requests || [];
  },

  async sendMessage(receiverId: string, subject: string, content: string, priority: string = 'Medium'): Promise<void> {
    await api.post('/manager/send-message', {
      receiver_id: receiverId,
      subject,
      content,
      priority
    });
  },

  async sendAnnouncement(subject: string, content: string, priority: string = 'Medium'): Promise<void> {
    await api.post('/manager/send-announcement', {
      subject,
      content,
      priority
    });
  }
};
