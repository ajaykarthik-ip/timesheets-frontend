"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Types
interface Project {
  id: number;
  name: string;
}


interface TimesheetEntry {
  id: number;
  user: number;
  user_email: string;
  user_name: string;
  user_designation: string;
  project: number;
  project_name: string;
  project_status: string;
  activity_type: string;
  date: string;
  hours_worked: string;
  description: string;
  status: string;
  status_display: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
  submitted_at: string;
}

interface DashboardStats {
  total_timesheets: number;
  total_hours: number;
  unique_users: number;
  unique_projects: number;
  draft_count: number;
  submitted_count: number;
  date_range: string;
}

interface TopUser {
  user__first_name: string;
  user__last_name: string;
  user__email: string;
  total_hours: number;
  entry_count: number;
}

interface TopProject {
  project__name: string;
  total_hours: number;
  entry_count: number;
  unique_users: number;
}

interface AllTimesheetsResponse {
  timesheets: TimesheetEntry[];
  pagination: {
    total_count: number;
    page_size: number;
    offset: number;
    has_more: boolean;
  };
  dashboard_stats: DashboardStats;
  top_users: TopUser[];
  top_projects: TopProject[];
  filters_applied: {
    user_id?: string;
    project_id?: string;
    status?: string;
    date_from?: string;
    date_to?: string;
    activity_type?: string;
    user_search?: string;
    project_search?: string;
  };
}

interface ProjectTimesheetSummary {
  employees: { [key: string]: string };
  activities: string[];
  data: { [userEmail: string]: { [activity: string]: number } };
  totals: {
    byEmployee: { [userEmail: string]: number };
    byActivity: { [activity: string]: number };
    grandTotal: number;
  };
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

// JWT API helper
const makeAPICall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem("access_token");

  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [projectData, setProjectData] = useState<ProjectTimesheetSummary | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [topUsers, setTopUsers] = useState<TopUser[]>([]);
  const [topProjects, setTopProjects] = useState<TopProject[]>([]);
  const [allTimesheets, setAllTimesheets] = useState<TimesheetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'project-summary'>('overview');

  // Default date range = current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    setDateFrom(firstDay.toISOString().split("T")[0]);
    setDateTo(lastDay.toISOString().split("T")[0]);
  }, []);

  const formatToBritishDate = (dateString: string): string => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (err) {
      console.error("Date formatting error:", err);
      return dateString;
    }
  };

  const fetchProjects = useCallback(async () => {
    try {
      const response = await makeAPICall(`${API_BASE}/projects/active/`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else {
        console.error("Failed to fetch projects");
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
      setError("Failed to load projects");
    }
  }, []);

  // NEW: Fetch all timesheets with dashboard stats
  const fetchAllTimesheets = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      params.append('page_size', '500'); // Get more data for admin

      const response = await makeAPICall(`${API_BASE}/timesheets/all/?${params}`);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You don't have permission to view all timesheets");
        }
        throw new Error("Failed to fetch timesheets");
      }

      const data: AllTimesheetsResponse = await response.json();
      
      setAllTimesheets(data.timesheets);
      setDashboardStats(data.dashboard_stats);
      setTopUsers(data.top_users);
      setTopProjects(data.top_projects);
      
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  // Fetch project-specific timesheets for detailed view
  const fetchProjectTimesheets = useCallback(async () => {
    if (!selectedProject || !dateFrom || !dateTo) return;

    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.append('project_id', selectedProject);
      params.append('date_from', dateFrom);
      params.append('date_to', dateTo);
      params.append('status', 'submitted');
      params.append('page_size', '500');

      const response = await makeAPICall(`${API_BASE}/timesheets/all/?${params}`);

      if (!response.ok) {
        throw new Error("Failed to fetch project timesheets");
      }

      const data: AllTimesheetsResponse = await response.json();
      const timesheets = data.timesheets || [];

      const summary = processTimesheetData(timesheets);
      setProjectData(summary);
    } catch (err) {
      setError("Failed to load project timesheets");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, dateFrom, dateTo]);

  const processTimesheetData = (timesheets: TimesheetEntry[]): ProjectTimesheetSummary => {
    const employees: { [key: string]: string } = {};
    const activities: Set<string> = new Set();
    const data: { [userEmail: string]: { [activity: string]: number } } = {};

    timesheets.forEach((ts) => {
      employees[ts.user_email] = ts.user_name;
      activities.add(ts.activity_type);

      if (!data[ts.user_email]) {
        data[ts.user_email] = {};
      }
      if (!data[ts.user_email][ts.activity_type]) {
        data[ts.user_email][ts.activity_type] = 0;
      }
      data[ts.user_email][ts.activity_type] += parseFloat(ts.hours_worked || "0");
    });

    const totals = {
      byEmployee: {} as { [userEmail: string]: number },
      byActivity: {} as { [activity: string]: number },
      grandTotal: 0,
    };

    Object.keys(data).forEach((userEmail) => {
      totals.byEmployee[userEmail] = Object.values(data[userEmail]).reduce(
        (sum, hours) => sum + hours,
        0
      );
    });

    Array.from(activities).forEach((activity) => {
      totals.byActivity[activity] = Object.keys(data).reduce((sum, userEmail) => {
        return sum + (data[userEmail][activity] || 0);
      }, 0);
    });

    totals.grandTotal = Object.values(totals.byEmployee).reduce(
      (sum, total) => sum + total,
      0
    );

    return {
      employees,
      activities: Array.from(activities).sort(),
      data,
      totals,
    };
  };

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Fetch all timesheets when date range changes or on load
  useEffect(() => {
    if (dateFrom && dateTo) {
      fetchAllTimesheets();
    }
  }, [dateFrom, dateTo, fetchAllTimesheets]);

  // Fetch project-specific data when project is selected
  useEffect(() => {
    if (selectedProject && dateFrom && dateTo) {
      fetchProjectTimesheets();
    } else {
      setProjectData(null);
    }
  }, [selectedProject, dateFrom, dateTo, fetchProjectTimesheets]);

  const getSelectedProjectName = () => {
    const project = projects.find((p) => p.id.toString() === selectedProject);
    return project ? project.name : "";
  };

  // Show loading if user data is not available yet
  if (!user) {
    return <div className="loading">Loading user information...</div>;
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Timesheet Dashboard</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filters-section">
        <h3>Select Project and Date Range</h3>
        
        <div className="form-row">
          <div className="form-group">
            <label>Project:</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">Select a project...</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Date To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        
        <p>
          <strong>Date Range:</strong> {formatToBritishDate(dateFrom)} - {formatToBritishDate(dateTo)}
        </p>
      </div>

      {loading && <div className="loading">Loading dashboard data...</div>}

      {/* Project Summary Display */}
      {!loading && projectData && selectedProject && (
        <div>
          <div className="admin-header">
            <h2>{getSelectedProjectName()}</h2>
            <p>Submitted timesheets for the selected period</p>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Employee Name</th>
                  {projectData.activities.map((activity) => (
                    <th key={activity}>{activity}</th>
                  ))}
                  <th>Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(projectData.employees).map(([userEmail, userName]) => (
                  <tr key={userEmail}>
                    <td>{userName}</td>
                    {projectData.activities.map((activity) => (
                      <td key={activity}>
                        {projectData.data[userEmail]?.[activity]
                          ? Math.round(projectData.data[userEmail][activity] * 100) / 100
                          : 0}h
                      </td>
                    ))}
                    <td>
                      <strong>
                        {Math.round(projectData.totals.byEmployee[userEmail] * 100) / 100}h
                      </strong>
                    </td>
                  </tr>
                ))}
                <tr className="totals-row">
                  <td><strong>Total</strong></td>
                  {projectData.activities.map((activity) => (
                    <td key={activity}>
                      <strong>
                        {Math.round(projectData.totals.byActivity[activity] * 100) / 100}h
                      </strong>
                    </td>
                  ))}
                  <td>
                    <strong>
                      {Math.round(projectData.totals.grandTotal * 100) / 100}h
                    </strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <h3>Total Employees</h3>
              <div className="number">{Object.keys(projectData.employees).length}</div>
            </div>
            <div className="stat-card">
              <h3>Total Activities</h3>
              <div className="number">{projectData.activities.length}</div>
            </div>
            <div className="stat-card">
              <h3>Total Hours</h3>
              <div className="number">{Math.round(projectData.totals.grandTotal * 100) / 100}h</div>
            </div>
            <div className="stat-card">
              <h3>Average Hours/Employee</h3>
              <div className="number">
                {Object.keys(projectData.employees).length > 0
                  ? Math.round((projectData.totals.grandTotal / Object.keys(projectData.employees).length) * 100) / 100
                  : 0}h
              </div>
            </div>
          </div>
        </div>
      )}

      {!selectedProject && !loading && (
        <div className="empty-state">
          <h3>Select a Project</h3>
          <p>Choose a project from the dropdown above to view the timesheet summary.</p>
        </div>
      )}

      {!loading && selectedProject && projectData && Object.keys(projectData.employees).length === 0 && (
        <div className="empty-state">
          <h3>No Data Found</h3>
          <p>No submitted timesheet entries found for the selected project and date range.</p>
          <p>Ensure employees have submitted their timesheets for this project and period.</p>
        </div>
      )}
    </div>
  );
}