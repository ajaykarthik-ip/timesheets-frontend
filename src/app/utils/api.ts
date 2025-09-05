export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  designation: string;
  company: string;
  is_active: boolean;
  is_staff: boolean;
  is_admin: boolean;
  full_name: string;
  role: string;
}

export interface Timesheet {
  id: number;
  project_name: string;
  activity_type: string;
  date: string;
  hours_worked: string;
  status?: 'draft' | 'submitted';
  can_edit?: boolean;
  description?: string;
}

export interface Project {
  id: number;
  name: string;
}

interface AssignedProject {
  id: number;
  name: string;
  billable: boolean;
  status: string;
}

// Constants
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

// Track if we're currently refreshing token to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: Response) => void;
  reject: (error: any) => void;
  url: string;
  options: RequestInit;
}> = [];

// Process failed requests after token refresh
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject, url, options }) => {
    if (error) {
      reject(error);
    } else {
      // Retry the original request with new token
      fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`,
        },
      }).then(resolve).catch(reject);
    }
  });
  
  failedQueue = [];
};

// Enhanced API utility function with better token refresh handling
export const makeAPICall = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem('access_token');
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, mergedOptions);
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        // No refresh token, redirect to login immediately
        localStorage.clear();
        window.location.href = '/login';
        throw new Error('No refresh token available');
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, url, options: mergedOptions });
        });
      }

      // Start refresh process
      isRefreshing = true;

      try {
        const refreshResponse = await fetch(`${API_BASE}/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshResponse.ok) {
          const { access } = await refreshResponse.json();
          localStorage.setItem('access_token', access);
          
          // Process queued requests with new token
          processQueue(null, access);
          isRefreshing = false;

          // Retry original request with new token
          return fetch(url, {
            ...mergedOptions,
            headers: {
              ...mergedOptions.headers,
              'Authorization': `Bearer ${access}`,
            },
          });
        } else {
          // Refresh failed, clear everything and redirect
          const refreshError = new Error('Token refresh failed');
          processQueue(refreshError, null);
          isRefreshing = false;
          
          localStorage.clear();
          window.location.href = '/login';
          throw refreshError;
        }
      } catch (refreshError) {
        // Network or other error during refresh
        console.error('Token refresh error:', refreshError);
        processQueue(refreshError, null);
        isRefreshing = false;
        
        localStorage.clear();
        window.location.href = '/login';
        throw refreshError;
      }
    }
    
    return response;
  } catch (error) {
    console.error(`API Error for ${url}:`, error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error - please check your connection');
    }
    
    throw error;
  }
};

export const loadUserData = async (): Promise<User> => {
  try {
    const userResponse = await makeAPICall(`${API_BASE}/timesheets/user-info/`);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      
      return {
        id: userData.user_id,
        email: userData.email,
        first_name: userData.user_name.split(' ')[0] || '',
        last_name: userData.user_name.split(' ').slice(1).join(' ') || '',
        designation: userData.designation,
        company: userData.company,
        is_active: userData.is_active,
        is_staff: false,
        is_admin: false,
        full_name: userData.user_name,
        role: userData.designation
      };
    } else if (userResponse.status === 401) {
      throw new Error('Authentication expired');
    } else {
      throw new Error(`Failed to load user data: ${userResponse.status}`);
    }
  } catch (error) {
    console.error('Load user data error:', error);
    throw error;
  }
};

export const loadProjects = async (): Promise<Project[]> => {
  const response = await makeAPICall(`${API_BASE}/accounts/my-projects/`);
  
  if (!response.ok) {
    throw new Error(`Failed to load assigned projects: ${response.status}`);
  }
  
  const data = await response.json();
  
  return data.assigned_projects?.map((project: AssignedProject) => ({
    id: project.id,
    name: project.name,
    billable: project.billable,
    status: project.status
  })) || [];
};

export const loadTimesheets = async (dateFrom: string, dateTo: string): Promise<Timesheet[]> => {
  const timesheetResponse = await makeAPICall(
    `${API_BASE}/timesheets/my-timesheets/?date_from=${dateFrom}&date_to=${dateTo}`
  );
  
  if (timesheetResponse.ok) {
    const timesheetData = await timesheetResponse.json();
    return timesheetData.timesheets || [];
  }
  
  throw new Error(`Failed to load timesheets: ${timesheetResponse.status}`);
};

export const loadActivitiesForProject = async (projectId: number): Promise<string[]> => {
  const defaultActivities = [
    'Development',
    'Testing',
    'Code Review',
    'Bug Fixing',
    'Meeting',
    'Documentation'
  ];

  try {
    const response = await makeAPICall(
      `${API_BASE}/timesheets/project/${projectId}/activities/`
    );
    
    if (response.ok) {
      const data = await response.json();
      return data?.activity_types || defaultActivities;
    }
  } catch (error) {
    console.error(`Error loading activities for project ${projectId}:`, error);
  }
  
  return defaultActivities;
};

export const saveTimesheetEntry = async (
  timesheetId: number | null,
  projectId: number,
  activityType: string,
  date: string,
  hours: string
) => {
  const requestData = {
    project: projectId,
    activity_type: activityType,
    date: date,
    hours_worked: hours,
    description: ''
  };

  if (timesheetId) {
    return await makeAPICall(
      `${API_BASE}/timesheets/${timesheetId}/`,
      {
        method: 'PUT',
        body: JSON.stringify(requestData)
      }
    );
  } else {
    return await makeAPICall(
      `${API_BASE}/timesheets/`,
      {
        method: 'POST',
        body: JSON.stringify(requestData)
      }
    );
  }
};

export const deleteTimesheetEntry = async (timesheetId: number) => {
  return await makeAPICall(
    `${API_BASE}/timesheets/${timesheetId}/`,
    { method: 'DELETE' }
  );
};

export const submitWeekTimesheets = async (weekStartDate: string, forceSubmit: boolean = false) => {
  return await makeAPICall(
    `${API_BASE}/timesheets/submit-week/`,
    {
      method: 'POST',
      body: JSON.stringify({
        week_start_date: weekStartDate,
        force_submit: forceSubmit
      })
    }
  );
};

// Date utilities (unchanged)
export const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const getWeekDateRange = (currentDate: Date) => {
  const date = new Date(currentDate);
  const dayOfWeek = date.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  const monday = new Date(date);
  monday.setDate(date.getDate() - daysToMonday);
  
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  
  return {
    dateFrom: formatDate(monday),
    dateTo: formatDate(sunday)
  };
};

export const getWeekDates = (dateFrom: string): string[] => {
  const startDate = parseDate(dateFrom);
  const dates = [];
  
  for (let i = 0; i < 7; i++) {
    const currentDay = new Date(startDate);
    currentDay.setDate(startDate.getDate() + i);
    dates.push(formatDate(currentDay));
  }
  
  return dates;
};

export const formatWeekHeader = (dateFrom: string, dateTo: string): string => {
  const startDate = parseDate(dateFrom);
  const endDate = parseDate(dateTo);
  
  const startFormatted = startDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  
  const endFormatted = endDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  
  return `${startFormatted} - ${endFormatted}`;
};