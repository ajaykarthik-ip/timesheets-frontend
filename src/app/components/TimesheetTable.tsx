"use client";

import React, { useState, useCallback } from 'react';

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
  // Local state to store user input while editing (before saving)
  const [editingValues, setEditingValues] = useState<{[key: string]: string}>({});
  const [currentlySaving, setCurrentlySaving] = useState<Set<string>>(new Set());

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const hasData = orderedProjectActivities.length > 0 || Object.keys(tableData).length > 0;

  // To get timesheet for a specific cell
  const getTimesheet = useCallback((projectName: string, activityType: string, date: string): Timesheet | null => {
    return timesheets.find(ts =>
      ts.project_name === projectName &&
      ts.activity_type === activityType &&
      ts.date === date
    ) || null;
  }, [timesheets]);

  // To get the original saved value from tableData
  const getSavedValue = useCallback((projectName: string, activityType: string, date: string): string => {
    const tableKey = `${projectName}-${activityType}`;
    return tableData[tableKey]?.[date] || '';
  }, [tableData]);

  // To get current display value (editing value or saved value)
  const getCurrentValue = useCallback((projectName: string, activityType: string, date: string): string => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    
    // If user is currently editing this cell, show the editing value
    if (editingValues.hasOwnProperty(cellKey)) {
      return editingValues[cellKey];
    }
    
    // Otherwise show the saved value
    return getSavedValue(projectName, activityType, date);
  }, [editingValues, getSavedValue]);

  // Helper function to check if cell has been modified but not saved
  const isModified = useCallback((projectName: string, activityType: string, date: string): boolean => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    if (!editingValues.hasOwnProperty(cellKey)) return false;
    
    const editingValue = editingValues[cellKey];
    const savedValue = getSavedValue(projectName, activityType, date);
    return editingValue !== savedValue;
  }, [editingValues, getSavedValue]);

  // To get cell status for display
  const getCellStatus = useCallback((projectName: string, activityType: string, date: string) => {
    const timesheet = getTimesheet(projectName, activityType, date);
    const currentValue = getCurrentValue(projectName, activityType, date);
    const cellKey = `${projectName}-${activityType}-${date}`;
    
    // If currently saving
    if (currentlySaving.has(cellKey)) {
      return 'saving';
    }
    
    // If user has modified but not saved
    if (isModified(projectName, activityType, date)) {
      return 'modified';
    }
    
    // If no value, it's blank
    if (!currentValue || currentValue === '' || parseFloat(currentValue) === 0) {
      return 'blank';
    }
    
    // If timesheet exists and is submitted, it's locked
    if (timesheet?.status === 'submitted') {
      return 'submitted';
    }
    
    // If timesheet exists and is draft, it's saved
    if (timesheet?.status === 'draft') {
      return 'draft';
    }
    
    // If value exists but no timesheet, it might be unsaved from previous session
    return 'unsaved';
  }, [getTimesheet, getCurrentValue, currentlySaving, isModified]);

  // Helper function to get CSS class for cell status
  const getCellStatusClass = (status: string) => {
    switch (status) {
      case 'submitted':
        return { bg: 'rgba(52, 199, 89, 0.15)', border: 'rgba(52, 199, 89, 0.4)' };
      case 'draft':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' };
      case 'modified':
        return { bg: 'rgba(255, 193, 7, 0.15)', border: 'rgba(255, 193, 7, 0.4)' };
      case 'saving':
        return { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' };
      case 'unsaved':
        return { bg: 'rgba(255, 152, 0, 0.15)', border: 'rgba(255, 152, 0, 0.4)' };
      default:
        return { bg: 'rgba(255, 255, 255, 0.05)', border: 'rgba(255, 255, 255, 0.2)' };
    }
  };

  // Check if cell is editable
  const isCellEditable = useCallback((projectName: string, activityType: string, date: string): boolean => {
    const status = getCellStatus(projectName, activityType, date);
    return status !== 'submitted' && status !== 'saving';
  }, [getCellStatus]);

  // Handle input change (only updates local editing state, NO SAVING)
  const handleInputChange = (projectName: string, activityType: string, date: string, value: string) => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    
    setEditingValues(prev => ({
      ...prev,
      [cellKey]: value
    }));
  };

  // Handle when user starts editing 
  const handleInputFocus = (projectName: string, activityType: string, date: string) => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    const currentSavedValue = getSavedValue(projectName, activityType, date);
    
    // Initialize editing value with current saved value if not already editing
    if (!editingValues.hasOwnProperty(cellKey)) {
      setEditingValues(prev => ({
        ...prev,
        [cellKey]: currentSavedValue
      }));
    }
  };

  // Handle when user stops editing - THIS IS WHERE WE SAVE
  const handleInputBlur = useCallback(async (projectName: string, activityType: string, date: string) => {
    const cellKey = `${projectName}-${activityType}-${date}`;
    const editingValue = editingValues[cellKey];
    const savedValue = getSavedValue(projectName, activityType, date);
    
    // Only save if value actually changed
    if (editingValue !== undefined && editingValue !== savedValue) {
      try {
        // Mark as saving
        setCurrentlySaving(prev => new Set(prev).add(cellKey));
        
        // Save to backend
        await onCellChange(projectName, activityType, date, editingValue);
        
        // Remove from editing state after successful save
        setEditingValues(prev => {
          const newValues = { ...prev };
          delete newValues[cellKey];
          return newValues;
        });
      } catch (error) {
        console.error('Error saving timesheet:', error);
      } finally {
        // Remove from saving state
        setCurrentlySaving(prev => {
          const newSet = new Set(prev);
          newSet.delete(cellKey);
          return newSet;
        });
      }
    } else {
      // No changes, just remove from editing state
      setEditingValues(prev => {
        const newValues = { ...prev };
        delete newValues[cellKey];
        return newValues;
      });
    }
  }, [editingValues, onCellChange, getSavedValue]);

  // Handle Enter key to move to next cell 
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const getDayTotal = (date: string): number => {
    return Object.keys(groupedProjectActivities).reduce((sum, projectName) => {
      return sum + groupedProjectActivities[projectName].reduce((projectSum, { activityType }) => {
        const value = getCurrentValue(projectName, activityType, date);
        return projectSum + (value && value !== '' ? parseFloat(value) : 0);
      }, 0);
    }, 0);
  };

  const getGrandTotal = (): number => {
    return weekDates.reduce((total, date) => total + getDayTotal(date), 0);
  };

  // Check if there are any unsaved modifications
  const hasUnsavedChanges = (): boolean => {
    return Object.keys(editingValues).some(cellKey => {
      const [projectName, activityType, date] = cellKey.split('-');
      return isModified(projectName, activityType, date);
    });
  };

  return (
    <div>
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
          <span>Empty</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '12px',
            height: '12px',
            background: 'rgba(239, 68, 68, 0.6)',
            borderRadius: '2px'
          }}></div>
          <span>Draft</span>
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

      {hasUnsavedChanges() && (
        <div style={{
          background: 'rgba(255, 193, 7, 0.1)',
          border: '1px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          color: 'rgba(255, 193, 7, 0.9)',
          fontSize: '14px'
        }}>
        </div>
      )}

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
                        const cellValue = getCurrentValue(projectName, activityType, date);
                        const status = getCellStatus(projectName, activityType, date);
                        const isEditable = isCellEditable(projectName, activityType, date);
                        const styling = getCellStatusClass(status);
                        
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
                          borderStyle: 'solid',
                          background: styling.bg,
                          borderColor: styling.border
                        };

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
                              onChange={(e) => handleInputChange(projectName, activityType, date, e.target.value)}
                              onFocus={() => handleInputFocus(projectName, activityType, date)}
                              onBlur={() => handleInputBlur(projectName, activityType, date)}
                              onKeyDown={handleKeyPress}
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
          disabled={saving || currentlySaving.size > 0 || hasUnsavedChanges()}
          style={{
            background: (saving || currentlySaving.size > 0 || hasUnsavedChanges()) ? 'rgba(59, 130, 246, 0.5)' : '#3b82f6',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: (saving || currentlySaving.size > 0 || hasUnsavedChanges()) ? 'not-allowed' : 'pointer',
            fontWeight: '500',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          {saving ? 'Submitting...' : 
           currentlySaving.size > 0 ? `Saving... (${currentlySaving.size})` :
           hasUnsavedChanges() ? 'Save changes first' :
           'Submit Week'}
        </button>
      </div>
    </div>
  );
}