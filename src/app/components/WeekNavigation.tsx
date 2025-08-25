"use client";

import React from 'react';

interface WeekNavigationProps {
  currentWeek: string;
  onNavigateWeek: (direction: number) => void;
}

export default function WeekNavigation({ currentWeek, onNavigateWeek }: WeekNavigationProps) {
  return (
    <div className="header-section">
      <h2>Timesheet - {currentWeek}</h2>
      <div className="nav-buttons">
        <button 
          onClick={() => onNavigateWeek(-1)} 
          className="nav-btn"
        >
          ‹ Previous Week
        </button>
        <button 
          onClick={() => onNavigateWeek(1)} 
          className="nav-btn"
        >
          Next Week ›
        </button>
      </div>
    </div>
  );
}