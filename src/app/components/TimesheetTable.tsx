// Update your TimesheetTable.tsx component

"use client";

import React, { useState } from 'react';

interface Timesheet {
  id: number;
  project_name: string;
  activity_type: string;
  date: string;
  hours_worked: string;
  status?: 'draft' | 'submitted';
  can_edit?: boolean;
  description?: string;
}

interface TimesheetTableProps {
  tableData: {[key: string]: {[date: string]: string}};
  weekDates: string[];
  timesheets: Timesheet[];
  groupedProjectActivities: {[key: string]: {activityType: string, key: string}[]};
  onCellChange: (projectName: string, activityType: string, date: string, value: string) => void;
  saving: boolean;
  onSubmitWeek: () => void;
}

export default function TimesheetTable({
  tableData,
  weekDates,
  timesheets,
  groupedProjectActivities,
  onCellChange,
  saving,
  onSubmitWeek
}: TimesheetTableProps) {
  const [editingCell, setEditingCell] = useState<{project: string, activity: string, date: string} | null>(null);

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hasData = Object.keys(groupedProjectActivities).length > 0 || Object.keys(tableData).length > 0;

  // Helper function to get timesheet status for a specific cell
  const getTimesheetStatus = (projectName: string, activityType: string, date: string) => {
    const timesheet = timesheets.find(ts =>
      ts.project_name === projectName &&
      ts.activity_type === activityType &&
      ts.date === date
    );
    return timesheet?.status || null;
  };

  // Helper function to get cell status class
  const getCellStatusClass = (projectName: string, activityType: string, date: string, value: string) => {
    const status = getTimesheetStatus(projectName, activityType, date);
    
    if (!value || value === '' || parseFloat(value) === 0) {
      return 'empty';
    }
    
    if (status === 'submitted') {
      return 'submitted';
    }
    
    if (status === 'draft' || (!status && value && parseFloat(value) > 0)) {
      return 'draft';
    }
    
    return 'empty';
  };

  // Helper function to check if a row has submitted entries
  const getRowStatus = (projectName: string, activityType: string) => {
    const hasSubmitted = timesheets.some(ts =>
      ts.project_name === projectName &&
      ts.activity_type === activityType &&
      ts.status === 'submitted'
    );
    
    const hasDraft = timesheets.some(ts =>
      ts.project_name === projectName &&
      ts.activity_type === activityType &&
      ts.status === 'draft'
    );
    
    if (hasSubmitted) return 'has-submitted';
    if (hasDraft) return 'has-draft';
    return '';
  };

  const getDayTotal = (date: string): number => {
    return Object.keys(tableData).reduce((sum, key) => {
      const hours = tableData[key][date];
      return sum + (hours && hours !== '' ? parseFloat(hours) : 0);
    }, 0);
  };

  const getGrandTotal = (): number => {
    return Object.keys(tableData).reduce((sum, key) => {
      const rowSum = Object.values(tableData[key]).reduce((rowTotal, hours) => {
        return rowTotal + (hours && hours !== '' ? parseFloat(hours) : 0);
      }, 0);
      return sum + rowSum;
    }, 0);
  };

  return (
    <div>
      {/* Status Legend */}
      <div className="status-legend">
        <div className="legend-item">
          <div className="legend-dot submitted"></div>
          <span>Submitted</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot draft"></div>
          <span>Draft/Unsubmitted</span>
        </div>
        <div className="legend-item">
          <div className="legend-dot empty"></div>
          <span>Empty</span>
        </div>
      </div>

      {/* Timesheet Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Activity</th>
              {weekDays.map(day => (
                <th key={day}>{day}</th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {!hasData ? (
              <tr>
                <td colSpan={weekDays.length + 2} className="empty-state">
                  No timesheets for this week. Click "Add Project Activity" to get started.
                </td>
              </tr>
            ) : (
              Object.entries(groupedProjectActivities).map(([projectName, activities]) => (
                <React.Fragment key={projectName}>
                  {activities.map(({ activityType, key }, index) => {
                    const hasSubmittedEntries = timesheets.some(ts =>
                      ts.project_name === projectName &&
                      ts.activity_type === activityType &&
                      ts.status === 'submitted'
                    );

                    const rowStatus = getRowStatus(projectName, activityType);

                    return (
                      <tr key={key}>
                        {index === 0 && (
                          <td 
                            rowSpan={activities.length} 
                            className={`project-cell ${rowStatus}`}
                          >
                            {projectName}
                          </td>
                        )}
                        
                        <td className={`activity-cell ${rowStatus}`}>
                          {activityType}
                        </td>

                        {weekDates.map(date => {
                          const cellValue = tableData[key]?.[date] || '';
                          const statusClass = getCellStatusClass(projectName, activityType, date, cellValue);

                          return (
                            <td key={date}>
                              <input
                                type="number"
                                value={cellValue}
                                // placeholder="0"
                                min="0"
                                max="24"
                                step="0.5"
                                onChange={(e) => onCellChange(
                                  projectName,
                                  activityType,
                                  date,
                                  e.target.value
                                )}
                                onFocus={() => setEditingCell({
                                  project: projectName,
                                  activity: activityType,
                                  date: date
                                })}
                                onBlur={() => setEditingCell(null)}
                                disabled={hasSubmittedEntries}
                                className={`time-input ${statusClass} ${
                                  editingCell?.project === projectName &&
                                  editingCell?.activity === activityType &&
                                  editingCell?.date === date ? 'editing' : ''
                                }`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </tbody>

          {hasData && (
            <tfoot>
              <tr className="totals-row">
                <td colSpan={2}>Daily Totals</td>
                {weekDates.map(date => (
                  <td key={date} className="total-cell">
                    <span className="total-hours">
                      {getDayTotal(date).toFixed(1)}h
                    </span>
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="total-hours">
          Total Hours: 
          <span className="grand-total">
            {getGrandTotal().toFixed(1)}h
          </span>
        </div>
        
        <div className="footer-buttons">
          <button
            className={`submit-btn ${saving ? 'saving' : ''}`}
            onClick={onSubmitWeek}
            disabled={saving}
          >
            {saving ? 'Submitting...' : 'Submit Week'}
          </button>
        </div>
      </div>
    </div>
  );
}