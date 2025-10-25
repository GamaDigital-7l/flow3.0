"use client";

import React from 'react';
import AppLogo from './AppLogo';
import ThemeToggle from '../ThemeToggle'; // Assuming a ThemeToggle component exists
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuToggle }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border h-14 px-4 flex items-center justify-between">
      
      {/* Mobile Menu Button (if applicable) */}
      <Button 
        variant="ghost" 
        size="icon" 
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Logo - Centralizado no Header */}
      <div className="flex-1 flex justify-start lg:justify-center">
        <AppLogo />
      </div>

      {/* Right Side: Theme Toggle, User Menu, etc. */}
      <div className="flex items-center space-x-2">
        <ThemeToggle />
        {/* Placeholder for User Avatar/Menu */}
        {/* <UserAvatar /> */}
      </div>
    </header>
  );
};

export default Header;