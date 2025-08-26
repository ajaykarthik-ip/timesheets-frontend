"use client";

import { useState, useEffect, useCallback } from 'react';
import { User } from '../../utils/api';

// Types
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
  const [projects, setProjects] = useState<Project[]>([]);
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
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [, setCurrentUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    billable: true,
    status: 'active',
    activity_types_list: [] as string[]
  });

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const response = await makeAPICall(`${API_BASE}/projects/`);
      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data.projects || []);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
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
      await Promise.all([fetchProjects(), fetchChoices()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProjects, fetchChoices]);

  // Load current user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const response = await makeAPICall(`${API_BASE}/timesheets/user-info/`);
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData);
        }
      } catch (error) {
        console.error('Failed to load user info:', error);
      }
    };
    loadUser();
  }, []);

  const filteredProjects = projects.filter(project => 
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      billable: project.billable,
      status: project.status,
      activity_types_list: project.activity_types_display || []
    });
    setShowForm(true);
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Delete ${project.name}?`)) return;

    try {
      const response = await makeAPICall(`${API_BASE}/projects/${project.id}/`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete project');
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
    </div>
  );
}
