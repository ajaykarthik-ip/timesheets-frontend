"use client";

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  designation: string;
  company: string;
  is_active: boolean;
  is_staff: boolean;
  is_admin: boolean;
  full_name: string;
  role: string;
  last_login?: string;
}

interface UserFormData {
  email: string;
  first_name: string;
  last_name: string;
  designation: string;
  company?: string;
  password?: string;
  is_active: boolean;
  is_staff: boolean;
  is_admin: boolean;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

// JWT API helper
const makeAPICall = async (url: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('access_token');

  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    first_name: '',
    last_name: '',
    designation: 'employee',
    company: 'Mobiux',
    password: '',
    is_active: true,
    is_staff: false,
    is_admin: false,
  });

  // Designation choices
  const designationChoices = [
    { value: 'employee', label: 'Employee' },
    { value: 'senior_employee', label: 'Senior Employee' },
    { value: 'team_lead', label: 'Team Lead' },
    { value: 'manager', label: 'Manager' },
    { value: 'senior_manager', label: 'Senior Manager' },
    { value: 'director', label: 'Director' },
  ];

  // Load current user
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await makeAPICall(`${API_BASE}/auth/profile/`);
        if (response.ok) {
          const userData = await response.json();
          setCurrentUser(userData.user);
        }
      } catch (error) {
        console.error('Failed to load current user:', error);
      }
    };
    loadCurrentUser();
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await makeAPICall(`${API_BASE}/auth/users/?page_size=100`);

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      } else if (response.status === 403) {
        setError('Admin privileges required to view users');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch users');
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(
        'Failed to load users: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load users
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  // Filter users
  const filteredUsers = users.filter(
    (user) =>
      user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.designation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  //  CORRECTED: Form submit with proper endpoints
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (editingUser) {
        // UPDATE USER - Use PUT to /users/{id}/update/
        const response = await makeAPICall(
          `${API_BASE}/auth/users/${editingUser.id}/update/`,
          {
            method: 'PUT',
            body: JSON.stringify(formData),
          }
        );

        if (response.ok) {
          setSuccess('User updated successfully');
          fetchUsers();
          resetForm();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update user');
        }
      } else {
        // CREATE USER - Use POST to /users/create/
        const response = await makeAPICall(`${API_BASE}/auth/users/create/`, {
          method: 'POST',
          body: JSON.stringify(formData),
        });

        if (response.ok) {
          setSuccess('User created successfully');
          fetchUsers();
          resetForm();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create user');
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      email: '',
      first_name: '',
      last_name: '',
      designation: 'employee',
      company: 'Mobiux',
      password: '',
      is_active: true,
      is_staff: false,
      is_admin: false,
    });
    setShowForm(false);
    setEditingUser(null);
  };

  // Handle edit
  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      designation: user.designation,
      company: user.company,
      password: '', // Don't populate password for edit
      is_active: user.is_active,
      is_staff: user.is_staff,
      is_admin: user.is_admin,
    });
    setShowForm(true);
    setError('');
    setSuccess('');
  };

  //  CORRECTED: Delete user using proper endpoint
  const handleDelete = async (user: User) => {
    if (user.id === currentUser?.id) {
      setError('Cannot delete your own account');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${user.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      // DELETE USER - Use DELETE to /users/{id}/delete/
      const response = await makeAPICall(
        `${API_BASE}/auth/users/${user.id}/delete/`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setSuccess('User deleted successfully');
        fetchUsers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete user');
      }
    } catch (err) {
      setError(
        'Failed to delete user: ' +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  //  ADDED: Toggle user status (if you want to implement this)
  const handleToggleStatus = async (user: User) => {
    const action = user.is_active ? 'deactivate' : 'activate';
    
    if (!confirm(`Are you sure you want to ${action} ${user.full_name}?`)) {
      return;
    }

    try {
      // Update user status using the update endpoint
      const response = await makeAPICall(
        `${API_BASE}/auth/users/${user.id}/update/`,
        {
          method: 'PUT',
          body: JSON.stringify({ is_active: !user.is_active }),
        }
      );

      if (response.ok) {
        setSuccess(`User ${action}d successfully`);
        fetchUsers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${action} user`);
      }
    } catch (err) {
      setError(
        `Failed to ${action} user: ` +
          (err instanceof Error ? err.message : 'Unknown error')
      );
    }
  };

  if (loading) {
    return <div className="loading">Loading users...</div>;
  }

  return (
    <div>
      <div className="admin-header">
        <h1>User Management</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="actions">
        <input
          type="text"
          placeholder="Search users..."
          className="search-box"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          Add User
        </button>
      </div>

      {users.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Designation</th>
              <th>Company</th>
              <th>Status</th>
              <th>Admin</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id}>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`status-badge status-${user.designation}`}>
                    {designationChoices.find(d => d.value === user.designation)?.label || user.designation}
                  </span>
                </td>
                <td>{user.company}</td>
                <td>
                  <span
                    className={`status-badge ${
                      user.is_active ? 'status-active' : 'status-inactive'
                    }`}
                  >
                    {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-badge ${
                      user.is_admin
                        ? 'status-admin'
                        : user.is_staff
                        ? 'status-staff'
                        : 'status-employee'
                    }`}
                  >
                    {user.is_admin ? 'ADMIN' : user.is_staff ? 'STAFF' : 'USER'}
                  </span>
                </td>
                <td className="last-login">
                  {user.last_login
                    ? new Date(user.last_login).toLocaleDateString()
                    : 'Never'}
                </td>
                <td>
                  <button
                    className="btn btn-warning mr-4"
                    onClick={() => handleEdit(user)}
                  >
                    Edit
                  </button>
                  <button
                    className={`btn ${
                      user.is_active ? 'btn-danger' : 'btn-success'
                    } mr-4`}
                    onClick={() => handleToggleStatus(user)}
                    disabled={user.id === currentUser?.id}
                  >
                    {user.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(user)}
                    disabled={user.id === currentUser?.id}
                    title={
                      user.id === currentUser?.id
                        ? 'Cannot delete yourself'
                        : 'Delete user'
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {filteredUsers.length === 0 && !loading && (
        <div className="empty-state">
          {searchTerm ? 'No users found matching your search.' : 'No users found.'}
        </div>
      )}

      {showForm && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingUser ? 'Edit User' : 'Add User'}</h2>
              <button className="close-btn" onClick={resetForm}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.first_name}
                    onChange={(e) =>
                      setFormData({ ...formData, first_name: e.target.value })
                    }
                    placeholder="Enter first name"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.last_name}
                    onChange={(e) =>
                      setFormData({ ...formData, last_name: e.target.value })
                    }
                    placeholder="Enter last name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Email Address *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter email address"
                  disabled={!!editingUser}
                />
                {editingUser && (
                  <small>Email cannot be changed after user creation</small>
                )}
              </div>

              {!editingUser && (
                <div className="form-group">
                  <label>Password *</label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    placeholder="Enter password (min 8 characters)"
                    minLength={8}
                  />
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Designation *</label>
                  <select
                    required
                    value={formData.designation}
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                  >
                    {designationChoices.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    placeholder="Company name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({ ...formData, is_active: e.target.checked })
                      }
                    />
                    Active User
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_staff}
                      onChange={(e) =>
                        setFormData({ ...formData, is_staff: e.target.checked })
                      }
                    />
                    Staff Access
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.is_admin}
                      onChange={(e) =>
                        setFormData({ ...formData, is_admin: e.target.checked })
                      }
                    />
                    Admin Access
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" className="btn" onClick={resetForm}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}