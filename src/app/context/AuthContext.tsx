"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
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
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

  // Helper function to make authenticated API calls
  const makeAPICall = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("access_token");
    
    return fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });
  };

  // Check if user is already logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('🔍 AuthContext: Checking authentication...');
        const token = localStorage.getItem("access_token");
        
        if (!token) {
          console.log('❌ AuthContext: No token found');
          setLoading(false);
          return;
        }

        const response = await makeAPICall(`${API_BASE}/auth/profile/`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ AuthContext: User is authenticated:', data.user);
          setUser(data.user);
        } else {
          console.log('❌ AuthContext: Token invalid, clearing storage');
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
        }
      } catch (error) {
        console.log('❌ AuthContext: Auth check failed:', error);
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [API_BASE]);

  const login = async (email: string, password: string) => {
    try {
      console.log('🔑 AuthContext: Attempting login for:', email);
      
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ AuthContext: Login successful');
        
        // Store JWT tokens
        localStorage.setItem("access_token", data.access);
        localStorage.setItem("refresh_token", data.refresh);
        
        // Set user data
        setUser(data.user);
        
        return { success: true };
      } else {
        console.log('❌ AuthContext: Login failed:', data.error);
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('❌ AuthContext: Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 AuthContext: Logging out...');
      
      // Try to call logout endpoint (optional since we're using JWT)
      await makeAPICall(`${API_BASE}/auth/logout/`, {
        method: 'POST',
      });
      
      console.log('✅ AuthContext: Logout successful');
    } catch (error) {
      console.error('❌ AuthContext: Logout error:', error);
    } finally {
      // Clear tokens and user data
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      router.push('/login');
    }
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}