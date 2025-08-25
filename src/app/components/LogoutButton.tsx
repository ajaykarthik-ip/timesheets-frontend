"use client";

import { useAuth } from '../context/AuthContext';

export default function LogoutButton() {
  const { logout, user } = useAuth();

  // Debug logging
  console.log('🔍 LogoutButton - Rendering, user:', user);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  // Always render the button, regardless of user state
  return (
    <div 
      className="logout-section"
      style={{
        padding: '12px 0',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        marginTop: '16px'
      }}
    >
      <button
        onClick={handleLogout}
        className="logout-btn"
        style={{
          width: '100%',
          padding: '10px 16px',
          background: 'rgba(255, 59, 48, 0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 59, 48, 0.3)',
          borderRadius: '8px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '12px',
          fontWeight: '500',
          letterSpacing: '-0.01em',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif'
        }}
      >
        Logout
      </button>
    </div>
  );
}