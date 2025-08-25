"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import './page.css';
import UserSidebar from './components/UserSidebar';
import WeekNavigation from './components/WeekNavigation';
import AddProjectRow from './components/AddProjectRow';
import TimesheetTable from './components/TimesheetTable';
import {
  User,
  Timesheet,
  Project,
  loadUserData,
  loadProjects,
  loadTimesheets,
  loadActivitiesForProject,
  saveTimesheetEntry,
  deleteTimesheetEntry,
  submitWeekTimesheets,
  getWeekDateRange,
  getWeekDates,
  formatWeekHeader
} from './utils/api';

export default function MainPage() {
  const [user, setUser] = useState<User | null>(null);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [tableData, setTableData] = useState<{[key: string]: {[date: string]: string}}>({});
  const [projectActivities, setProjectActivities] = useState<Map<string, string[]>>(new Map());
  const [manuallyAddedRows, setManuallyAddedRows] = useState<Set<string>>(new Set());
  
  // Refs to prevent infinite loops
  const previousWeekKey = useRef<string>('');

  // Computed values
  const dateRange = useMemo(() => getWeekDateRange(currentDate), [currentDate]);
  const weekDates = useMemo(() => getWeekDates(dateRange.dateFrom), [dateRange]);

  const groupedProjectActivities = useMemo(() => {
    const groups: {[key: string]: {activityType: string, key: string}[]} = {};
    
    // Add timesheet entries
    timesheets.forEach(entry => {
      if (!groups[entry.project_name]) {
        groups[entry.project_name] = [];
      }
      
      const key = `${entry.project_name}-${entry.activity_type}`;
      const exists = groups[entry.project_name].find(item => item.key === key);
      
      if (!exists) {
        groups[entry.project_name].push({
          activityType: entry.activity_type,
          key
        });
      }
    });

    // Add manually added rows for the current week
    manuallyAddedRows.forEach(key => {
      const parts = key.split('-');
      const projectName = parts[0];
      const activityType = parts.slice(1).join('-');
      
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      
      const exists = groups[projectName].find(item => item.key === key);
      if (!exists) {
        groups[projectName].push({
          activityType,
          key
        });
      }
    });
    
    return groups;
  }, [timesheets, manuallyAddedRows]);

  // Data loading
  const loadData = useCallback(async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Load user data
      if (!user) {
        try {
          const userData = await loadUserData();
          setUser(userData);
        } catch (userError) {
          window.location.href = '/login';
          return;
        }
      }

      // Load projects and timesheets in parallel
      const [projectData, timesheetData] = await Promise.allSettled([
        loadProjects(),
        loadTimesheets(dateRange.dateFrom, dateRange.dateTo)
      ]);

      if (projectData.status === 'fulfilled') {
        setProjects(projectData.value);
      }

      if (timesheetData.status === 'fulfilled') {
        setTimesheets(timesheetData.value);
      }

    } catch (error) {
      showNotification('Failed to load data. Please try refreshing the page.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dateRange, user]);

  const loadActivities = useCallback(async () => {
    if (!projects.length) return;
    
    const activitiesMap = new Map<string, string[]>();

    const activityPromises = projects.map(async (project) => {
      const activities = await loadActivitiesForProject(project.id);
      activitiesMap.set(project.name, activities);
    });

    await Promise.all(activityPromises);
    setProjectActivities(activitiesMap);
  }, [projects]);

  const initializeTableData = useCallback(() => {
    const data: {[key: string]: {[date: string]: string}} = {};
    
    // Initialize rows from groupedProjectActivities
    Object.values(groupedProjectActivities)
      .flat()
      .forEach(({ key }) => {
        data[key] = {};
        weekDates.forEach(date => {
          data[key][date] = '0';
        });
      });

    // Populate with existing timesheet data
    timesheets.forEach(timesheet => {
      const key = `${timesheet.project_name}-${timesheet.activity_type}`;
      if (!data[key]) {
        data[key] = {};
        weekDates.forEach(date => {
          data[key][date] = '0';
        });
      }
      data[key][timesheet.date] = timesheet.hours_worked;
    });
    
    setTableData(data);
  }, [groupedProjectActivities, weekDates, timesheets]);

  // Check if week has changed and reset state accordingly
  const checkWeekChange = useCallback(() => {
    const currentWeekKey = `${dateRange.dateFrom}-${dateRange.dateTo}`;
    
    if (previousWeekKey.current && previousWeekKey.current !== currentWeekKey) {
      // Week has changed, reset manually added rows and table data
      setManuallyAddedRows(new Set());
      setTableData({});
    }
    
    previousWeekKey.current = currentWeekKey;
  }, [dateRange]);

  // Effects
  useEffect(() => {
    checkWeekChange();
  }, [checkWeekChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (projects.length) {
      loadActivities();
    }
  }, [projects, loadActivities]);

  useEffect(() => {
    if (timesheets.length >= 0 && weekDates.length > 0) {
      initializeTableData();
    }
  }, [timesheets, weekDates, manuallyAddedRows, initializeTableData]);

  // Event handlers
  const handleCellChange = async (
    projectName: string,
    activityType: string,
    date: string,
    value: string
  ) => {
    const key = `${projectName}-${activityType}`;
    
    // Update local state immediately
    setTableData(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [date]: value
      }
    }));

    // Save or delete based on value
    const hours = parseFloat(value);
    if (hours > 0) {
      await saveTimesheet(projectName, activityType, date, value);
    } else {
      await deleteTimesheet(projectName, activityType, date);
    }
  };

  const saveTimesheet = async (
    projectName: string,
    activityType: string,
    date: string,
    hours: string
  ) => {
    if (!user) {
      showNotification('User not found', 'error');
      return;
    }

    try {
      const project = projects.find(p => p.name === projectName);
      if (!project) {
        showNotification(`Project "${projectName}" not found`, 'error');
        return;
      }

      const existingTimesheet = timesheets.find(ts =>
        ts.project_name === projectName &&
        ts.activity_type === activityType &&
        ts.date === date
      );

      if (existingTimesheet?.status === 'submitted') {
        showNotification('Cannot edit submitted timesheet', 'error');
        return;
      }

      const response = await saveTimesheetEntry(
        existingTimesheet?.id || null,
        project.id,
        activityType,
        date,
        hours
      );

      if (response?.ok) {
        showNotification(`Saved ${hours}h for ${projectName} - ${activityType} on ${date}`);
        await refreshTimesheets();
      } else {
        const errorData = await response?.json();
        showNotification(`Failed to save: ${errorData?.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      showNotification('Save failed: ' + error, 'error');
    }
  };

  const deleteTimesheet = async (
    projectName: string,
    activityType: string,
    date: string
  ) => {
    try {
      const existingTimesheet = timesheets.find(ts =>
        ts.project_name === projectName &&
        ts.activity_type === activityType &&
        ts.date === date
      );

      if (existingTimesheet && existingTimesheet.status !== 'submitted') {
        const response = await deleteTimesheetEntry(existingTimesheet.id);

        if (response.ok) {
          showNotification(`Cleared ${projectName} - ${activityType} on ${date}`);
          await refreshTimesheets();
        }
      }
    } catch (error) {
      showNotification('Delete failed: ' + error, 'error');
    }
  };

  const refreshTimesheets = async () => {
    try {
      const data = await loadTimesheets(dateRange.dateFrom, dateRange.dateTo);
      setTimesheets(data);
    } catch (error) {
      console.error('Failed to refresh timesheets:', error);
    }
  };

  const addNewRow = (projectName: string, activityType: string) => {
    const key = `${projectName}-${activityType}`;
    
    // Add to manually added rows set
    setManuallyAddedRows(prev => new Set([...prev, key]));
    
    showNotification(`Added ${projectName} - ${activityType} row`);
  };

  const removeRow = (projectName: string, activityType: string) => {
    const key = `${projectName}-${activityType}`;
    
    if (!confirm(`Remove ${projectName} - ${activityType} row?`)) {
      return;
    }

    // Remove from manually added rows
    setManuallyAddedRows(prev => {
      const newSet = new Set(prev);
      newSet.delete(key);
      return newSet;
    });

    // Remove from table data
    setTableData(prev => {
      const newData = { ...prev };
      delete newData[key];
      return newData;
    });

    // Delete any existing timesheets for this row
    weekDates.forEach(date => {
      deleteTimesheet(projectName, activityType, date);
    });

    showNotification(`Removed ${projectName} - ${activityType} row`);
  };

  const submitWeek = async () => {
    const draftTimesheets = timesheets.filter(ts => ts.status === 'draft');
    
    if (!draftTimesheets.length) {
      showNotification('No draft timesheets to submit', 'error');
      return;
    }

    if (!confirm(`Submit ${draftTimesheets.length} draft timesheet(s) for this week?`)) {
      return;
    }

    setSaving(true);

    try {
      const response = await submitWeekTimesheets(dateRange.dateFrom, false);
      const data = await response.json();

      if (response.ok) {
        showNotification(`Week submitted successfully! ${data.submitted_count} timesheets processed.`);
        await refreshTimesheets();
      } else if (data.can_force_submit) {
        const warningMessage = [
          'There are warnings with this submission:',
          ...(data.week_warnings || []),
          '',
          'Do you want to submit anyway?'
        ].join('\n');

        if (confirm(warningMessage)) {
          const forceResponse = await submitWeekTimesheets(dateRange.dateFrom, true);
          
          if (forceResponse.ok) {
            const forceData = await forceResponse.json();
            showNotification(`Week submitted with warnings! ${forceData.submitted_count} timesheets processed.`);
            await refreshTimesheets();
          } else {
            const errorData = await forceResponse.json();
            showNotification(`Submission failed: ${errorData.error}`, 'error');
          }
        }
      } else {
        showNotification(`Submission failed: ${data.error}`, 'error');
      }
    } catch (error) {
      showNotification('Submission failed: ' + error, 'error');
    } finally {
      setSaving(false);
    }
  };

  const navigateWeek = (direction: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction * 7));
    setCurrentDate(newDate);
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      setSuccess(message);
    } else {
      setError(message);
    }

    setTimeout(() => {
      setSuccess('');
      setError('');
    }, 3000);
  };

  // Loading and error states
  if (loading) {
    return (
      <div className="loading">
        <div className="loading-content">
          <div className="spinner"></div>
          <p>Loading your timesheet...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container">
        <div className="login-prompt">
          <h2>Please log in</h2>
          <p>You need to be logged in to access your timesheet.</p>
          <button 
            onClick={() => window.location.href = '/login'}
            className="login-btn"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin' || user.role === 'manager';
  const existingRows = Object.keys(tableData);

  return (
    <div className="app">
      <UserSidebar 
        user={{
          employee_id: user.id.toString(),
          employee_name: user.full_name,
          department: user.company,
          role: user.designation
        }} 
        isAdmin={isAdmin} 
      />
      
      <div className="main">
        <div className="container">
          <WeekNavigation 
            currentWeek={formatWeekHeader(dateRange.dateFrom, dateRange.dateTo)}
            onNavigateWeek={navigateWeek}
          />

          {/* Notifications */}
          {error && (
            <div className="notification error">{error}</div>
          )}
          {success && (
            <div className="notification success">{success}</div>
          )}

          <AddProjectRow
            projects={projects}
            projectActivities={projectActivities}
            onAddRow={addNewRow}
            existingRows={existingRows}
          />

          <TimesheetTable
            tableData={tableData}
            weekDates={weekDates}
            timesheets={timesheets}
            groupedProjectActivities={groupedProjectActivities}
            onCellChange={handleCellChange}
            saving={saving}
            onSubmitWeek={submitWeek}
          />
        </div>
      </div>
    </div>
  );
}