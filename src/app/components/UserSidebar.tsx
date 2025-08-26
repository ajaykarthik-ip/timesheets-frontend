import React from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from './LogoutButton';

interface LegacyUser {
  employee_id: string;
  employee_name: string;
  department: string;
  role: string;
}

interface UserSidebarProps {
  user?: LegacyUser; 
  isAdmin: boolean;
}

export default function UserSidebar({ user: propUser, isAdmin }: UserSidebarProps) {
  const { user: authUser } = useAuth();
  
  const user = authUser || propUser;
  
  if (!user) return null;
  
  const getUserData = () => {
    if (authUser) {
      return {
        name: authUser.full_name,
        id: authUser.id.toString(),
        department: authUser.company,
        role: authUser.designation,
        email: authUser.email
      };
    } else if (propUser) {
      return {
        name: propUser.employee_name,
        id: propUser.employee_id,
        department: propUser.department,
        role: propUser.role
      };
    }
    return null;
  };

  const userData = getUserData();
  if (!userData) return null;

  const hasAdminAccess = () => {

    
    const adminRoles = ['manager', 'director', 'senior_manager', 'admin'];
    const hasRoleAccess = adminRoles.includes(userData.role?.toLowerCase());
    
    // Check AuthContext admin status if available
    const authAdminAccess = authUser?.is_admin || false;
    const finalAccess = hasRoleAccess || authAdminAccess || isAdmin;
    
    return finalAccess;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <h2>Mobiux - Timesheet</h2>

        <div className="user-info">
          <p className="user-name">Welcome, {userData.name}</p>
          <p className="user-email">logged in as : {userData.email}</p>
        </div>

        <div>     
          {hasAdminAccess() && (
            <button 
              className="admin-btn" 
              onClick={() => window.location.href = '/admin'}
              title="Access admin dashboard"
            >
              Admin Panel
            </button>
          )}
        </div>

        <div className="logout-container">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}