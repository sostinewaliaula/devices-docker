import axios, { AxiosResponse } from 'axios';

// Use environment variable for API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // Helps identify AJAX requests
  },
  timeout: 30000, // 30 second timeout
  withCredentials: true, // Include cookies in requests
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      const currentPath = window.location.pathname;
      // Don't redirect if already on public auth pages
      const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-code'];
      if (!publicRoutes.includes(currentPath)) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'user';
  department_id?: string;
  department_name?: string;
  phone?: string;
  position?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at?: string;
  avatar_url?: string;
  profile_complete?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description?: string;
  location?: string;
  user_count: number;
  asset_count: number;
  asset_value: string;
  manager?: string;
  manager_id?: string;
  manager_name?: string;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  name: string;
  type: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  serial_number: string;
  purchase_date?: string;
  purchase_price: number;
  current_value: number;
  status: 'active' | 'inactive' | 'maintenance' | 'retired';
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  location?: string;
  assigned_to?: string;
  assigned_user_name?: string;
  assigned_user_email?: string;
  department_id?: string;
  department_name?: string;
  warranty_expiry?: string;
  last_maintenance?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'scheduled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  reported_by: string;
  reported_by_name?: string;
  reported_by_email?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  assigned_to_email?: string;
  asset_id?: string;
  asset_name?: string;
  asset_serial?: string;
  department_id?: string;
  department_name?: string;
  estimated_resolution_date?: string;
  actual_resolution_date?: string;
  estimated_cost?: number | null;
  created_at: string;
  updated_at: string;
  comments?: IssueComment[];
}

export interface IssueComment {
  id: string;
  issue_id: string;
  user_id: string;
  user_name: string;
  user_email?: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  is_read: boolean;
  created_at: string;
}

export interface SystemSetting {
  setting_key: string;
  setting_value: string;
  description: string;
  category: string;
  updated_at?: string;
}

export interface BudgetSummary {
  currency: string;
  combined: {
    total_issue_cost: number;
    total_asset_request_cost: number;
    overall_total: number;
  };
  issues: {
    total_cost: number;
    total_count: number;
    by_status: Record<string, number>;
    recent: Array<{
      id: string;
      name: string;
      status: string;
      estimated_cost: number | null;
      updated_at: string;
    }>;
  };
  asset_requests: {
    total_cost: number;
    total_count: number;
    by_status: Record<string, number>;
    recent: Array<{
      id: string;
      name: string;
      status: string;
      estimated_cost: number | null;
      updated_at: string;
    }>;
  };
}

// Authentication API
export const authAPI = {
  login: async (email: string, password: string): Promise<{ user: User; token: string; requiresMfa?: boolean; requiresMfaSetup?: boolean; tempToken?: string; userId?: string }> => {
    const response: AxiosResponse<{ user: User; token: string; requiresMfa?: boolean; requiresMfaSetup?: boolean; tempToken?: string; userId?: string }> = await api.post('/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  verifyMfaLogin: async (userId: string, factorId: string, token: string): Promise<{ user: User; token: string }> => {
    const response: AxiosResponse<{ user: User; token: string }> = await api.post('/auth/verify-mfa-login', {
      userId,
      factorId,
      token,
    });
    return response.data;
  },

  register: async (userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
    department_id?: string;
    phone?: string;
    position?: string;
  }): Promise<{ user: User; token: string }> => {
    const response: AxiosResponse<{ user: User; token: string }> = await api.post('/auth/register', userData);
    return response.data;
  },

  getProfile: async (): Promise<{ user: User }> => {
    const response: AxiosResponse<{ user: User }> = await api.get('/auth/profile');
    return response.data;
  },

  updateProfile: async (userData: { name?: string; phone?: string; position?: string; department_id?: string; email?: string }): Promise<{ user: User; message: string }> => {
    const response: AxiosResponse<{ user: User; message: string }> = await api.put('/auth/profile', userData);
    return response.data;
  },

  getPositions: async (): Promise<{ positions: { id: string; name: string }[] }> => {
    const response: AxiosResponse<{ positions: { id: string; name: string }[] }> = await api.get('/positions');
    return response.data;
  },

  getDepartments: async (): Promise<{ departments: Department[] }> => {
    const response: AxiosResponse<{ departments: Department[] }> = await api.get('/departments');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.put('/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  logout: async (): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post('/auth/logout');
    return response.data;
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post('/auth/forgot-password', {
      email,
    });
    return response.data;
  },

  resetPassword: async (token: string, password: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post('/auth/reset-password', {
      token,
      password,
    });
    return response.data;
  },

  validateResetToken: async (token: string): Promise<{ valid: boolean; user?: { email: string; name: string } }> => {
    const response: AxiosResponse<{ valid: boolean; user?: { email: string; name: string } }> = await api.get(`/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
    return response.data;
  },

  verifyResetCode: async (email: string, code: string): Promise<{ message: string; user: { email: string; name: string } }> => {
    const response: AxiosResponse<{ message: string; user: { email: string; name: string } }> = await api.post('/auth/verify-reset-code', {
      email,
      code,
    });
    return response.data;
  },

  changePasswordWithCode: async (email: string, code: string, password: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post('/auth/change-password-with-code', {
      email,
      code,
      password,
    });
    return response.data;
  },

  googleLogin: async (credential: string): Promise<{ user: User & { profile_complete: boolean; avatar_url?: string }; token: string; profile_complete: boolean }> => {
    const response: AxiosResponse<{ user: User & { profile_complete: boolean; avatar_url?: string }; token: string; profile_complete: boolean }> = await api.post('/auth/google/token', { credential });
    return response.data;
  },

  completeGoogleProfile: async (data: { position: string; department_id: string; phone?: string }): Promise<{ user: User; message: string }> => {
    const response: AxiosResponse<{ user: User; message: string }> = await api.post('/auth/google/complete-profile', data);
    return response.data;
  },
};

// Users API
export const usersAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    department_id?: string;
  }): Promise<{ users: User[]; pagination: any }> => {
    const response: AxiosResponse<{ users: User[]; pagination: any }> = await api.get('/users', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ user: User }> => {
    const response: AxiosResponse<{ user: User }> = await api.get(`/users/${id}`);
    return response.data;
  },

  create: async (userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    department_id?: string;
    phone?: string;
    position?: string;
  }): Promise<{ user: User }> => {
    const response: AxiosResponse<{ user: User }> = await api.post('/users', userData);
    return response.data;
  },

  update: async (id: string, userData: Partial<User>): Promise<{ user: User }> => {
    const response: AxiosResponse<{ user: User }> = await api.put(`/users/${id}`, userData);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/users/${id}`);
    return response.data;
  },
};

// Departments API
export const departmentsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{ departments: Department[]; pagination: any }> => {
    const response: AxiosResponse<{ departments: Department[]; pagination: any }> = await api.get('/departments', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ department: Department }> => {
    const response: AxiosResponse<{ department: Department }> = await api.get(`/departments/${id}`);
    return response.data;
  },

  create: async (departmentData: {
    name: string;
    description?: string;
    location?: string;
    manager_id?: string;
    parent_id?: string;
  }): Promise<{ department: Department }> => {
    const response: AxiosResponse<{ department: Department }> = await api.post('/departments', departmentData);
    return response.data;
  },

  update: async (id: string, departmentData: Partial<Department>): Promise<{ department: Department }> => {
    const response: AxiosResponse<{ department: Department }> = await api.put(`/departments/${id}`, departmentData);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/departments/${id}`);
    return response.data;
  },
};

// Assets API
export const assetsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    type?: string;
    department_id?: string;
    assigned_to?: string;
  }): Promise<{ assets: Asset[]; pagination: any }> => {
    const response: AxiosResponse<{ assets: Asset[]; pagination: any }> = await api.get('/assets', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ asset: Asset }> => {
    const response: AxiosResponse<{ asset: Asset }> = await api.get(`/assets/${id}`);
    return response.data;
  },

  create: async (assetData: {
    name: string;
    type: string;
    category?: string;
    manufacturer?: string;
    model?: string;
    serial_number: string;
    purchase_date?: string;
    purchase_price: number;
    current_value: number;
    status?: string;
    condition?: string;
    location?: string;
    assigned_to?: string;
    department_id?: string;
    warranty_expiry?: string;
    notes?: string;
  }): Promise<{ asset: Asset }> => {
    const response: AxiosResponse<{ asset: Asset }> = await api.post('/assets', assetData);
    return response.data;
  },

  update: async (id: string, assetData: Partial<Asset>): Promise<{ asset: Asset }> => {
    const response: AxiosResponse<{ asset: Asset }> = await api.put(`/assets/${id}`, assetData);
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/assets/${id}`);
    return response.data;
  },
};

// Issues API
export const issuesAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    priority?: string;
    department_id?: string;
    assigned_to?: string;
  }): Promise<{ issues: Issue[]; pagination: any; cost_summary?: { total_estimated_cost: number; currency: string } }> => {
    const response: AxiosResponse<{ issues: Issue[]; pagination: any; cost_summary?: { total_estimated_cost: number; currency: string } }> = await api.get('/issues', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ issue: Issue; comments: IssueComment[] }> => {
    const response: AxiosResponse<{ issue: Issue; comments: IssueComment[] }> = await api.get(`/issues/${id}`);
    return response.data;
  },

  create: async (issueData: {
    title: string;
    description: string;
    priority: string;
    category?: string;
    assigned_to?: string;
    asset_id?: string;
    department_id?: string;
    estimated_resolution_date?: string;
  }): Promise<{ issue: Issue }> => {
    const response: AxiosResponse<{ issue: Issue }> = await api.post('/issues', issueData);
    return response.data;
  },

  update: async (id: string, issueData: Partial<Issue>): Promise<{ issue: Issue }> => {
    const response: AxiosResponse<{ issue: Issue }> = await api.put(`/issues/${id}`, issueData);
    return response.data;
  },

  addComment: async (id: string, content: string): Promise<{ comment: IssueComment }> => {
    const response: AxiosResponse<{ comment: IssueComment }> = await api.post(`/issues/${id}/comments`, { content });
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/issues/${id}`);
    return response.data;
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    unread_only?: boolean;
  }): Promise<{ notifications: Notification[]; pagination: any }> => {
    const response: AxiosResponse<{ notifications: Notification[]; pagination: any }> = await api.get('/notifications', { params });
    return response.data;
  },

  getById: async (id: string): Promise<{ notification: Notification }> => {
    const response: AxiosResponse<{ notification: Notification }> = await api.get(`/notifications/${id}`);
    return response.data;
  },

  markAsRead: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<{ message: string; updated_count: number }> => {
    const response: AxiosResponse<{ message: string; updated_count: number }> = await api.put('/notifications/read-all');
    return response.data;
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.delete(`/notifications/${id}`);
    return response.data;
  },

  getStats: async (): Promise<{ statistics: any }> => {
    const response: AxiosResponse<{ statistics: any }> = await api.get('/notifications/stats/summary');
    return response.data;
  },
};

// Health check
export const healthAPI = {
  check: async (): Promise<{ status: string; timestamp: string; uptime: number; environment: string }> => {
    const response: AxiosResponse<{ status: string; timestamp: string; uptime: number; environment: string }> = await api.get('/health');
    return response.data;
  },
};

export const budgetAPI = {
  getSummary: async (): Promise<BudgetSummary> => {
    const response: AxiosResponse<BudgetSummary> = await api.get('/budget/summary');
    return response.data;
  },
  export: async (
    format: 'pdf' | 'word' | 'excel',
    options: { issueStatuses?: string[]; assetStatuses?: string[]; isGeneral?: boolean } = {}
  ): Promise<Blob> => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (options.issueStatuses?.length) params.append('issueStatuses', options.issueStatuses.join(','));
    if (options.assetStatuses?.length) params.append('assetStatuses', options.assetStatuses.join(','));
    if (options.isGeneral) params.append('general', 'true');

    const response = await api.get(`/budget/export?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export const settingsAPI = {
  getSettings: async (category?: string): Promise<SystemSetting[]> => {
    const response: AxiosResponse<SystemSetting[]> = await api.get('/settings', {
      params: { category }
    });
    return response.data;
  },
  updateSettings: async (settings: Array<{ setting_key: string; setting_value: string }>): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.put('/settings', { settings });
    return response.data;
  },
  testEmailSettings: async (): Promise<{ message: string }> => {
    const response: AxiosResponse<{ message: string }> = await api.post('/settings/test-email');
    return response.data;
  },
  getPublicSettings: async (): Promise<Record<string, string>> => {
    const response: AxiosResponse<Record<string, string>> = await api.get('/settings/public');
    return response.data;
  },
  getGoogleOAuthConfig: async (): Promise<{ enabled: boolean; clientId: string; allowedDomain: string }> => {
    const response: AxiosResponse<{ enabled: boolean; clientId: string; allowedDomain: string }> = await api.get('/settings/google-oauth-config');
    return response.data;
  },
};

export default api;

