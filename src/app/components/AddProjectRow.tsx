"use client";

import React, { useState } from 'react';

interface Project {
  id: number;
  name: string;
}

interface AddProjectRowProps {
  projects: Project[];
  projectActivities: Map<string, string[]>;
  onAddRow: (projectName: string, activityType: string) => void;
  existingRows: string[];
}

export default function AddProjectRow({
  projects,
  projectActivities,
  onAddRow,
  existingRows
}: AddProjectRowProps) {
  const [showAddRow, setShowAddRow] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedActivity, setSelectedActivity] = useState('');

  const handleAddRow = () => {
    if (!selectedProject || !selectedActivity) {
      alert('Please select both project and activity');
      return;
    }

    const key = `${selectedProject}-${selectedActivity}`;
    if (existingRows.includes(key)) {
      alert('This project-activity combination already exists');
      return;
    }

    onAddRow(selectedProject, selectedActivity);
    
    // Reset form
    setSelectedProject('');
    setSelectedActivity('');
    setShowAddRow(false);
  };

  const handleCancel = () => {
    setShowAddRow(false);
    setSelectedProject('');
    setSelectedActivity('');
  };

  if (!showAddRow) {
    return (
      <div className="add-row-section">
        <button 
            onClick={() => setShowAddRow(true)} 
            className="subtle-add-btn"
            style={{
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.9)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
              letterSpacing: '-0.01em',
              marginBottom: '16px',
              minWidth: 'auto',
              width: 'fit-content',
              transition: 'all 0.2s ease-in-out',
              height: '40px'
            }}
            onFocus={(e) => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(255, 255, 255, 0.1)'}
            onBlur={(e) => e.currentTarget.style.boxShadow = 'none'}
          >
          Add Project Activity
          </button>
      </div>
    );
  }

  return (
    <div className="add-row-section">
      <div className="add-row-form">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="add-row-select"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            minWidth: '180px',
            height: '40px'
          }}
        >
          <option value="">Select Project</option>
          {projects.map(project => (
            <option key={project.id} value={project.name}>
              {project.name}
            </option>
          ))}
        </select>

        <select
          value={selectedActivity}
          onChange={(e) => setSelectedActivity(e.target.value)}
          disabled={!selectedProject}
          className="add-row-select"
          style={{
            background: selectedProject ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 12px',
            color: selectedProject ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px',
            minWidth: '180px',
            height: '40px',
            cursor: selectedProject ? 'pointer' : 'not-allowed'
          }}
        >
          <option value="">Select Activity</option>
          {selectedProject && 
            projectActivities.get(selectedProject)?.map(activity => (
              <option key={activity} value={activity}>
                {activity}
              </option>
            ))
          }
        </select>

        <button
          onClick={handleAddRow}
          disabled={!selectedProject || !selectedActivity}
          style={{
            background: (!selectedProject || !selectedActivity) 
              ? 'rgba(255, 255, 255, 0.03)' 
              : 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: (!selectedProject || !selectedActivity) 
              ? 'rgba(255, 255, 255, 0.5)' 
              : 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: (!selectedProject || !selectedActivity) ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            height: '40px'
          }}
        >
          Add Row
        </button>

        <button
          onClick={handleCancel}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            height: '40px'
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}