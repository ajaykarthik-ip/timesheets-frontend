"use client";

import { useState, useEffect, useCallback } from 'react';

// Types
interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  is_active: boolean;
}

interface Project {
  id: number;
  name: string;
  billable: boolean;
  status: string;
  status_display?: string;
  activity_types_display: string[];
  created_at: string;
  updated_at: string;
}

interface ProjectWithAssignments extends Project {
  assigned_users_count?: number;
  assigned_users?: User[];
}

interface ProjectChoices {
  statuses: { [key: string]: string };
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

// JWT API helper
const makeAPICall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('access_token');
  
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers,
    },
  });
};

export default function AdminProjects() {
  const [projects, setProjects] = useState<ProjectWithAssignments[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [choices, setChoices] = useState<ProjectChoices>({ 
    statuses: {
      'active': 'Active',
      'completed': 'Completed', 
      'on_hold': 'On Hold',
      'cancelled': 'Cancelled'
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectWithAssignments | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [selectedProjectForAssignment, setSelectedProjectForAssignment] = useState<ProjectWithAssignments | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    billable: true,
    status: 'active',
    activity_types_list: [] as string[]
  });

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const response = await makeAPICall(`${API_BASE}/accounts/users/`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  }, []);

  // Fetch projects with assignment data
  const fetchProjects = useCallback(async () => {
    try {
      const response = await makeAPICall(`${API_BASE}/projects/`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      
      // Fetch assignment data for each project
      const projectsWithAssignments = await Promise.all(
        (data.projects || []).map(async (project: Project) => {
          try {
            const assignmentResponse = await makeAPICall(`${API_BASE}/projects/${project.id}/assignments/`);
            if (assignmentResponse.ok) {
              const assignmentData = await assignmentResponse.json();
              return {
                ...project,
                assigned_users_count: assignmentData.assigned_users?.length || 0,
                assigned_users: assignmentData.assigned_users || []
              };
            }
          } catch (error) {
            console.error(`Failed to fetch assignments for project ${project.id}:`, error);
          }
          return {
            ...project,
            assigned_users_count: 0,
            assigned_users: []
          };
        })
      );
      
      setProjects(projectsWithAssignments);
    } catch {
      setError('Failed to load projects');
    }
  }, []);

  // Fetch choices
  const fetchChoices = useCallback(async () => {
    try {
      const response = await makeAPICall(`${API_BASE}/projects/choices/`);
      if (response.ok) {
        const data = await response.json();
        setChoices(data);
      }
    } catch {
      console.log('Using default project choices');
    }
  }, []);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProjects(), fetchChoices(), fetchUsers()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProjects, fetchChoices, fetchUsers]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle assignment modal
  const handleAssignUsers = (project: ProjectWithAssignments) => {
    setSelectedProjectForAssignment(project);
    setSelectedUserIds(project.assigned_users?.map(u => u.id) || []);
    setShowAssignmentModal(true);
  };

  // Save user assignments
  const handleSaveAssignments = async () => {
    if (!selectedProjectForAssignment) return;

    setAssignmentLoading(true);
    try {
      const response = await makeAPICall(`${API_BASE}/projects/${selectedProjectForAssignment.id}/assign-users/`, {
        method: 'POST',
        body: JSON.stringify({
          user_ids: selectedUserIds
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(data.message || 'User assignments updated successfully');
        await fetchProjects(); // Refresh projects
        setShowAssignmentModal(false);
        setSelectedProjectForAssignment(null);
        setSelectedUserIds([]);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update assignments');
      }
    } catch {
      setError('Failed to update assignments');
    } finally {
      setAssignmentLoading(false);
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Select/Deselect all users
  const handleSelectAll = () => {
    const activeUsers = users.filter(user => user.is_active);
    if (selectedUserIds.length === activeUsers.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(activeUsers.map(user => user.id));
    }
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      let response;
      if (editingProject) {
        response = await makeAPICall(`${API_BASE}/projects/${editingProject.id}/`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        response = await makeAPICall(`${API_BASE}/projects/`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save project');
      }

      const data = await response.json();
      setSuccess(data.message || `Project ${editingProject ? 'updated' : 'created'} successfully`);
      await fetchProjects();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      billable: true,
      status: 'active',
      activity_types_list: []
    });
    setShowForm(false);
    setEditingProject(null);
    setError('');
  };

  const handleEdit = (project: ProjectWithAssignments) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      billable: project.billable,
      status: project.status,
      activity_types_list: project.activity_types_display || []
    });
    setShowForm(true);
  };

  const handleDelete = async (project: ProjectWithAssignments) => {
    if (!confirm(`Delete ${project.name}? This will also remove all user assignments.`)) return;

    try {
      const response = await makeAPICall(`${API_BASE}/projects/${project.id}/`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete project');
      setSuccess('Project deleted successfully');
      await fetchProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const addActivityType = () =>
    setFormData({ ...formData, activity_types_list: [...formData.activity_types_list, ''] });

  const removeActivityType = (index: number) =>
    setFormData({ ...formData, activity_types_list: formData.activity_types_list.filter((_, i) => i !== index) });

  const updateActivityType = (index: number, value: string) => {
    const newList = [...formData.activity_types_list];
    newList[index] = value;
    setFormData({ ...formData, activity_types_list: newList });
  };

  if (loading) return <div className="loading">Loading projects...</div>;

  return (
    <div>
      <div className="admin-header">
        <h1>Project Management</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="actions">
        <input
          type="text"
          placeholder="Search projects..."
          className="search-box"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add Project
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Billable</th>
            <th>Status</th>
            <th>Activity Types</th>
            <th>Assigned Users</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map((project) => (
            <tr key={project.id}>
              <td>{project.name}</td>
              <td>
                <span className={`status-badge ${project.billable ? 'status-active' : 'status-inactive'}`}>
                  {project.billable ? 'YES' : 'NO'}
                </span>
              </td>
              <td>
                <span className={`status-badge status-${project.status}`}>
                  {project.status_display || choices.statuses[project.status] || project.status.toUpperCase()}
                </span>
              </td>
              <td>{project.activity_types_display?.length ? project.activity_types_display.join(', ') : 'No activities defined'}</td>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="status-badge status-active">
                    {project.assigned_users_count || 0} users
                  </span>
                  <button 
                    className="btn btn-primary btn-small" 
                    onClick={() => handleAssignUsers(project)}
                    title="Manage user assignments"
                  >
                    Manage
                  </button>
                </div>
              </td>
              <td>
                <button className="btn btn-warning" onClick={() => handleEdit(project)}>Edit</button>
                <button className="btn btn-danger" onClick={() => handleDelete(project)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!filteredProjects.length && !loading && <div className="empty-state">No projects found.</div>}

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingProject ? 'Edit Project' : 'Add Project'}</h2>
              <button className="close-btn" onClick={resetForm}>×</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Client A - Website Redesign"
                  />
                </div>
                <div className="form-group">
                  <label>Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    {Object.entries(choices.statuses).map(([key, value]) => (
                      <option key={key} value={key}>{value}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={formData.billable}
                    onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                  />
                  Billable Project
                </label>
              </div>

              <div className="form-group">
                <label>Activity Types</label>
                <small className="help-text">
                  Define the types of activities that can be tracked for this project
                </small>

                {formData.activity_types_list.map((activity, index) => (
                  <div key={index} className="activity-row">
                    <input
                      type="text"
                      value={activity}
                      onChange={(e) => updateActivityType(index, e.target.value)}
                      placeholder="e.g., Development, Testing, Design"
                      className="activity-input"
                    />
                    <button
                      type="button"
                      onClick={() => removeActivityType(index)}
                      className="btn btn-danger btn-small"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                
                <button type="button" onClick={addActivityType} className="btn btn-secondary">
                  Add Activity Type
                </button>

                {!formData.activity_types_list.length && (
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      activity_types_list: ['Development', 'Testing', 'Design', 'Meeting']
                    })}
                    className="btn btn-success"
                  >
                    Add Default Activities
                  </button>
                )}
              </div>

              <div className="form-actions">
                <button type="button" className="btn" onClick={resetForm}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editingProject ? 'Update' : 'Add'} Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Assignment Modal */}
      {showAssignmentModal && selectedProjectForAssignment && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Manage User Assignments - {selectedProjectForAssignment.name}</h2>
              <button className="close-btn" onClick={() => setShowAssignmentModal(false)}>×</button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ color: 'rgba(255, 255, 255, 0.8)', margin: 0 }}>
                  Select users who can log time for this project:
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={handleSelectAll}
                >
                  {selectedUserIds.length === users.filter(u => u.is_active).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              <div style={{ 
                maxHeight: '300px', 
                overflowY: 'auto',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.02)'
              }}>
                {users.filter(user => user.is_active).map(user => (
                  <label key={user.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                    {user.full_name} ({user.email})
                  </label>
                ))}
                
                {users.filter(user => user.is_active).length === 0 && (
                  <p style={{ textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)', margin: '16px 0' }}>
                    No active users found
                  </p>
                )}
              </div>
              
              <p style={{ 
                marginTop: '8px', 
                fontSize: '11px', 
                color: 'rgba(255, 255, 255, 0.6)',
                margin: '8px 0 0 0'
              }}>
                Selected: {selectedUserIds.length} of {users.filter(u => u.is_active).length} active users
              </p>
            </div>

            <div className="form-actions">
              <button 
                type="button" 
                className="btn" 
                onClick={() => setShowAssignmentModal(false)}
                disabled={assignmentLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={handleSaveAssignments}
                disabled={assignmentLoading}
              >
                {assignmentLoading ? 'Saving...' : 'Save Assignments'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}