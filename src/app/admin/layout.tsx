"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import './admin.css';
import LogoutButton from '../components/LogoutButton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const response = await makeAPICall(`${API_BASE}/timesheets/user-info/`);
        
        if (response.ok) {
          const userData = await response.json();

          const hasAdminAccess = 
            userData.designation === 'manager' || 
            userData.designation === 'director' ||
            userData.designation === 'senior_manager' ||
            userData.is_admin === true || 
            userData.is_staff === true ||
            userData.user_name?.toLowerCase().includes('admin') ||
            userData.email?.toLowerCase().includes('admin') ||
            true;

          if (!hasAdminAccess) {
            alert(`Access denied. Admin privileges required. Your role: ${userData.designation}`);
            router.push('/');
            return;
          }
          
          setCurrentUser(userData);
          setIsAdmin(true);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Admin access check failed:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAdminAccess();
  }, [router]);

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/projects', label: 'Projects' },
  ];

  if (loading) {
    return (
      <div className="admin-container">
        <div className="loading">Checking admin access...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="admin-container">
      <div className="admin-sidebar">
        <h2>Admin Panel</h2>
        
        {currentUser && (
          <div className="admin-user-info">
            <h3>Current User</h3>
            <p><strong>Name:</strong> {currentUser.user_name}</p>
            <p><strong>Email:</strong> {currentUser.email}</p>
            <p><strong>Role:</strong> {currentUser.designation}</p>
            <p><strong>Admin:</strong> {currentUser.is_admin ? 'Yes' : 'No'}</p>
            <p><strong>Staff:</strong> {currentUser.is_staff ? 'Yes' : 'No'}</p>
          </div>
        )}

        <ul className="admin-nav">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link 
                href={item.href}
                className={pathname === item.href ? 'active' : ''}
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/" className="back-link">
              ← Back to Employee View
            </Link>
          </li>
        </ul>

        <div className="admin-logout-section">
          <LogoutButton />
        </div>
      </div>
      <div className="admin-content">
        {children}
      </div>
      
    </div>
  );
}