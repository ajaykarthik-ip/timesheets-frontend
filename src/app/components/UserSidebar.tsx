import React from 'react';
import { useAuth } from '../context/AuthContext';
import LogoutButton from './LogoutButton';

// Keep the original interface for backward compatibility
interface LegacyUser {
  employee_id: string;
  employee_name: string;
  department: string;
  role: string;
}

interface UserSidebarProps {
  user?: LegacyUser; // Optional for backward compatibility
  isAdmin: boolean;
}

export default function UserSidebar({ user: propUser, isAdmin }: UserSidebarProps) {
  const { user: authUser } = useAuth();
  
  // Use AuthContext user if available, otherwise fall back to prop user
  const user = authUser || propUser;
  
  if (!user) return null;
  
  // Helper function to get user data in consistent format
  const getUserData = () => {
    if (authUser) {
      // Data from AuthContext
      return {
        name: authUser.full_name,
        id: authUser.id.toString(),
        department: authUser.company,
        role: authUser.designation
      };
    } else if (propUser) {
      // Data from props (legacy format)
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
    console.log('🔍 Sidebar - User data:', userData);
    console.log('🔍 Sidebar - User role:', userData.role);
    console.log('🔍 Sidebar - isAdmin prop:', isAdmin);
    
    const adminRoles = ['manager', 'director', 'senior_manager', 'admin'];
    const hasRoleAccess = adminRoles.includes(userData.role?.toLowerCase());
    
    // Check AuthContext admin status if available
    const authAdminAccess = authUser?.is_admin || false;
    const finalAccess = hasRoleAccess || authAdminAccess || isAdmin;
    
    console.log('🔍 Sidebar - Final access:', finalAccess);
    return finalAccess;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
        <div>
          <h2>Mobiux - Timesheet</h2>
          {/* <div className="user-info">
            <p><strong>Name:</strong> {userData.name}</p>
            <p><strong>ID:</strong> {userData.id}</p>
            <p><strong>Department:</strong> {userData.department}</p>
            <p><strong>Role:</strong> {userData.role}</p>
          </div> */}
          
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