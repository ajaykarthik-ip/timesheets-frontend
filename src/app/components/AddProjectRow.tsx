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
          className="modern-add-btn"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.8) 0%, rgba(88, 86, 214, 0.8) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '12px',
            padding: '14px 24px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'white',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif',
            letterSpacing: '-0.01em',
            marginBottom: '16px',
            minWidth: 'auto',
            width: 'fit-content'
          }}
          onMouseEnter={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(-2px)';
            target.style.boxShadow = '0 8px 25px rgba(0, 122, 255, 0.35)';
            target.style.background = 'linear-gradient(135deg, rgba(0, 122, 255, 0.9) 0%, rgba(88, 86, 214, 0.9) 100%)';
          }}
          onMouseLeave={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(0)';
            target.style.boxShadow = '0 4px 20px rgba(0, 122, 255, 0.25)';
            target.style.background = 'linear-gradient(135deg, rgba(0, 122, 255, 0.8) 0%, rgba(88, 86, 214, 0.8) 100%)';
          }}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(0) scale(0.98)';
          }}
          onMouseUp={(e) => {
            const target = e.target as HTMLElement;
            target.style.transform = 'translateY(-2px) scale(1)';
          }}
        >
          <span style={{
            fontSize: '16px',
            lineHeight: '1',
            fontWeight: 'bold'
          }}>+</span>
          Add Project Activity
        </button>
      </div>
    );
  }

  return (
    <div className="add-row-section">
      <div 
        className="add-row-form"
        style={{
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
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
              ? 'rgba(255, 255, 255, 0.1)' 
              : 'rgba(52, 199, 89, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            padding: '10px 16px',
            color: 'white',
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
            background: 'rgba(255, 59, 48, 0.15)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 59, 48, 0.3)',
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