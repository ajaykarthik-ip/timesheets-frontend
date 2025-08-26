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
  // State
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
  
  // Stable reference for row ordering - this prevents jumping
  const stableRowOrder = useRef<string[]>([]);

  // Computed values
  const dateRange = useMemo(() => getWeekDateRange(currentDate), [currentDate]);
  const weekDates = useMemo(() => getWeekDates(dateRange.dateFrom), [dateRange]);

  const groupedProjectActivities = useMemo(() => {
    const groups: {[key: string]: {activityType: string, key: string}[]} = {};
    const newRowKeys: string[] = [];
    
    // First, collect all unique keys from both sources
    const allKeys = new Set<string>();
    
    // Add keys from existing timesheets
    timesheets.forEach(entry => {
      const key = `${entry.project_name}-${entry.activity_type}`;
      allKeys.add(key);
    });
    
    // Add keys from manually added rows
    manuallyAddedRows.forEach(key => {
      allKeys.add(key);
    });
    
    // Convert to array and maintain order based on existing stable order
    const currentKeys = Array.from(allKeys);
    
    // Create new order: existing stable order first, then new keys
    const orderedKeys = [
      ...stableRowOrder.current.filter(key => currentKeys.includes(key)),
      ...currentKeys.filter(key => !stableRowOrder.current.includes(key))
    ];
    
    // Update stable order reference
    stableRowOrder.current = orderedKeys;
    
    // Build groups in the stable order
    orderedKeys.forEach(key => {
      const parts = key.split('-');
      const projectName = parts[0];
      const activityType = parts.slice(1).join('-');
      
      if (!groups[projectName]) {
        groups[projectName] = [];
      }
      
      groups[projectName].push({
        activityType,
        key
      });
    });
    
    return groups;
  }, [timesheets, manuallyAddedRows]);

  // Calculate total hours for validation
  const getTotalHours = useCallback((): number => {
    return Object.keys(tableData).reduce((sum, key) => {
      const rowSum = Object.values(tableData[key]).reduce((rowTotal, hours) => {
        return rowTotal + parseFloat(hours || '0');
      }, 0);
      return sum + rowSum;
    }, 0);
  }, [tableData]);

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
          data[key][date] = '';
        });
      });

    // Populate with existing timesheet data
    timesheets.forEach(timesheet => {
      const key = `${timesheet.project_name}-${timesheet.activity_type}`;
      if (!data[key]) {
        data[key] = {};
        weekDates.forEach(date => {
          data[key][date] = '';
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
      // Reset stable row order for new week
      stableRowOrder.current = [];
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

    // Remove from stable order
    stableRowOrder.current = stableRowOrder.current.filter(orderKey => orderKey !== key);

    // Delete any existing timesheets for this row
    weekDates.forEach(date => {
      deleteTimesheet(projectName, activityType, date);
    });

    showNotification(`Removed ${projectName} - ${activityType} row`);
  };

  const submitWeek = async () => {
    const draftTimesheets = timesheets.filter(ts => ts.status === 'draft');
    const totalHours = getTotalHours();
    const minimumHours = 40;
    
    if (!draftTimesheets.length) {
      showNotification('No draft timesheets to submit', 'error');
      return;
    }

    // Check minimum hours requirement
    if (totalHours < minimumHours) {
      const hoursShort = minimumHours - totalHours;
      showNotification(
        `Cannot submit: You need ${hoursShort.toFixed(1)} more hours to meet the minimum requirement of ${minimumHours}h per week.`,
        'error'
      );
      return;
    }

    if (!confirm(`Submit ${draftTimesheets.length} draft timesheet(s) for this week? (Total: ${totalHours.toFixed(1)}h)`)) {
      return;
    }

    setSaving(true);

    try {
      const response = await submitWeekTimesheets(dateRange.dateFrom, false);
      const data = await response.json();

      if (response.ok) {
        showNotification(`Week submitted successfully! ${data.submitted_count} timesheets processed. (Total: ${totalHours.toFixed(1)}h)`);
        await refreshTimesheets();
      } else if (data.can_force_submit) {
        const warningMessage = [
          'There are warnings with this submission:',
          ...(data.week_warnings || []),
          '',
          `Total hours: ${totalHours.toFixed(1)}h`,
          'Do you want to submit anyway?'
        ].join('\n');

        if (confirm(warningMessage)) {
          const forceResponse = await submitWeekTimesheets(dateRange.dateFrom, true);
          
          if (forceResponse.ok) {
            const forceData = await forceResponse.json();
            showNotification(`Week submitted with warnings! ${forceData.submitted_count} timesheets processed. (Total: ${totalHours.toFixed(1)}h)`);
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
    }, 2000); // Reduced to 2 seconds for floating notifications
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

          {/* Floating Toast Notifications */}
          {error && (
            <div style={{
              position: 'fixed',
              top: '16px',
              right: '16px',
              background: 'rgba(239, 68, 68, 0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#dc2626',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              zIndex: 9999,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              maxWidth: '280px',
              minWidth: '120px',
              animation: 'slideInFromRight 0.5s ease-out forwards, fadeOut 0.5s ease-in 2.5s forwards'
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              position: 'fixed',
              top: '16px',
              right: '16px',
              background: 'rgba(52, 199, 89, 0.15)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: '#16a34a',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              zIndex: 9999,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid rgba(52, 199, 89, 0.2)',
              maxWidth: '280px',
              minWidth: '120px',
              animation: 'slideInFromRight 0.5s ease-out forwards, fadeOut 0.5s ease-in 2.5s forwards'
            }}>
              {success}
            </div>
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
            onSubmitWeek={submitWeek} orderedProjectActivities={[]}          />
        </div>
      </div>
    </div>
  );
}