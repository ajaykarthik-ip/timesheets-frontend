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
  orderedProjectActivities: {projectName: string, activityType: string, key: string}[];
  onCellChange: (projectName: string, activityType: string, date: string, value: string) => void;
  saving: boolean;
  onSubmitWeek: () => void;
}

export default function TimesheetTable({
  tableData,
  weekDates,
  timesheets,
  groupedProjectActivities,
  orderedProjectActivities,
  onCellChange,
  saving,
  onSubmitWeek
}: TimesheetTableProps) {
  const [editingCell, setEditingCell] = useState<{project: string, activity: string, date: string} | null>(null);
  // Removed unused setCellValues
  const [cellValues] = useState<{[key: string]: string}>({});

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hasData = orderedProjectActivities.length > 0 || Object.keys(tableData).length > 0;

  // Helper function to get timesheet for a specific cell
  const getTimesheet = (projectName: string, activityType: string, date: string): Timesheet | null => {
    return timesheets.find(ts =>
      ts.project_name === projectName &&
      ts.activity_type === activityType &&
      ts.date === date
    ) || null;
  };

  // Helper function to get cell value (from local state or table data)
  const getCellValue = (projectName: string, activityType: string, date: string): string => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    const key = `${projectName}-${activityType}`;
    
    // Check local state first (for unsaved changes)
    if (cellValues[cellKey] !== undefined) {
      return cellValues[cellKey];
    }
    
    // Fall back to table data
    return tableData[key]?.[date] || '';
  };

  // Helper function to get cell status
  const getCellStatus = (projectName: string, activityType: string, date: string) => {
    const timesheet = getTimesheet(projectName, activityType, date);
    const cellValue = getCellValue(projectName, activityType, date);
    
    // If no value, it's blank
    if (!cellValue || cellValue === '' || parseFloat(cellValue) === 0) {
      return 'blank';
    }
    
    // If timesheet exists and is submitted, it's locked (green)
    if (timesheet?.status === 'submitted') {
      return 'submitted';
    }
    
    // If timesheet exists and is draft, it's saved (red)
    if (timesheet?.status === 'draft') {
      return 'draft';
    }
    
    // If value exists but no timesheet, it's unsaved
    return 'unsaved';
  };

  // Helper function to get CSS class for cell status
  const getCellStatusClass = (projectName: string, activityType: string, date: string) => {
    const status = getCellStatus(projectName, activityType, date);
    
    switch (status) {
      case 'submitted':
        return 'submitted'; // Green
      case 'draft':
        return 'draft'; // Red
      case 'unsaved':
        return 'unsaved'; // Yellow/orange for unsaved changes
      case 'blank':
      default:
        return 'empty'; // Default styling
    }
  };

  // Check if cell is editable
  const isCellEditable = (projectName: string, activityType: string, date: string): boolean => {
    const status = getCellStatus(projectName, activityType, date);
    // Only submitted cells are locked, everything else is editable
    return status !== 'submitted';
  };

  // Handle cell input change - auto-save like original
  const handleCellChange = async (projectName: string, activityType: string, date: string, value: string) => {
    // Auto-save like the original component
    await onCellChange(projectName, activityType, date, value);
  };

  const getDayTotal = (date: string): number => {
    return Object.keys(groupedProjectActivities).reduce((sum, projectName) => {
      return sum + groupedProjectActivities[projectName].reduce((projectSum, { activityType }) => {
        const value = getCellValue(projectName, activityType, date);
        return projectSum + (value && value !== '' ? parseFloat(value) : 0);
      }, 0);
    }, 0);
  };

  const getGrandTotal = (): number => {
    return weekDates.reduce((total, date) => total + getDayTotal(date), 0);
  };

  return (
    <div>
      {/* Action Buttons - Removed */}

      {/* Status Legend */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '16px',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '2px'
          }}></div>
          <span>Blank (Editable)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: 'rgba(239, 68, 68, 0.6)',
            borderRadius: '2px'
          }}></div>
          <span>Saved Draft (Editable)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: 'rgba(52, 199, 89, 0.6)',
            borderRadius: '2px'
          }}></div>
          <span>Submitted (Locked)</span>
        </div>
      </div>

      {/* Timesheet Table */}
      <div style={{
        overflow: 'auto',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: 'none'
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '12px 8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: '600',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>Project</th>
              <th style={{
                padding: '12px 8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontWeight: '600',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>Activity</th>
              {weekDays.map(day => (
                <th key={day} style={{
                  padding: '12px 8px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  textAlign: 'center'
                }}>{day}</th>
              ))}
            </tr>
          </thead>
          
          <tbody>
            {!hasData ? (
              <tr>
                <td colSpan={weekDays.length + 2} style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontStyle: 'italic'
                }}>
                  No timesheets for this week. Click &quot;Add Project Activity&quot; to get started.
                </td>
              </tr>
            ) : (
              Object.entries(groupedProjectActivities).map(([projectName, activities]) => (
                <React.Fragment key={projectName}>
                  {activities.map(({ activityType, key }, index) => (
                    <tr key={key} style={{
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      {index === 0 && (
                        <td 
                          rowSpan={activities.length}
                          style={{
                            padding: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            verticalAlign: 'middle',
                            fontWeight: '500',
                            color: 'rgba(255, 255, 255, 0.9)'
                          }}
                        >
                          {projectName}
                        </td>
                      )}
                      
                      <td style={{
                        padding: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'rgba(255, 255, 255, 0.8)'
                      }}>
                        {activityType}
                      </td>

                      {weekDates.map(date => {
                        const cellValue = getCellValue(projectName, activityType, date);
                        const statusClass = getCellStatusClass(projectName, activityType, date);
                        const isEditable = isCellEditable(projectName, activityType, date);
                        
                        const cellStyle: React.CSSProperties = {
                          width: '80px',
                          padding: '6px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          textAlign: 'center',
                          color: 'rgba(255, 255, 255, 0.9)',
                          transition: 'all 0.2s ease',
                          cursor: isEditable ? 'pointer' : 'not-allowed',
                          borderWidth: '1px',
                          borderStyle: 'solid'
                        };

                        // Apply status-specific styling
                        switch (statusClass) {
                          case 'submitted':
                            cellStyle.background = 'rgba(52, 199, 89, 0.15)';
                            cellStyle.borderColor = 'rgba(52, 199, 89, 0.4)';
                            break;
                          case 'draft':
                            cellStyle.background = 'rgba(239, 68, 68, 0.15)';
                            cellStyle.borderColor = 'rgba(239, 68, 68, 0.4)';
                            break;
                          default:
                            cellStyle.background = 'rgba(255, 255, 255, 0.05)';
                            cellStyle.borderColor = 'rgba(255, 255, 255, 0.2)';
                        }

                        return (
                          <td key={date} style={{
                            padding: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            textAlign: 'center'
                          }}>
                            <input
                              type="number"
                              value={cellValue}
                              min="0"
                              max="24"
                              step="0.5"
                              onChange={(e) => handleCellChange(projectName, activityType, date, e.target.value)}
                              onFocus={() => setEditingCell({
                                project: projectName,
                                activity: activityType,
                                date: date
                              })}
                              onBlur={() => setEditingCell(null)}
                              disabled={!isEditable}
                              style={cellStyle}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            )}
          </tbody>

          {hasData && (
            <tfoot>
              <tr>
                <td colSpan={2} style={{
                  padding: '12px 8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  fontWeight: '600',
                  color: 'rgba(255, 255, 255, 0.9)',
                  background: 'rgba(255, 255, 255, 0.05)'
                }}>
                  Daily Totals
                </td>
                {weekDates.map(date => (
                  <td key={date} style={{
                    padding: '12px 8px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    textAlign: 'center',
                    fontWeight: '600',
                    color: 'rgba(255, 255, 255, 0.9)',
                    background: 'rgba(255, 255, 255, 0.05)'
                  }}>
                    {getDayTotal(date).toFixed(1)}h
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '10px'
      }}>
        <div style={{
          fontSize: '18px',
          fontWeight: '600',
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Total Hours: <span style={{ color: 'rgba(52, 199, 89, 0.9)' }}>{getGrandTotal().toFixed(1)}h</span>
        </div>
        
        <button
          onClick={onSubmitWeek}
          disabled={saving}
          style={{
            background: saving ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: saving ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          {saving ? 'Submitting...' : 'Submit Week'}
        </button>
      </div>
    </div>
  );
}