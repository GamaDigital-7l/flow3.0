"use client";

import React from 'react';
import { BookOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description }) => {
  return (
    <div className="text-center text-muted-foreground p-12 border border-dashed rounded-xl bg-card">
      <BookOpen className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
      <h2 className="text-lg font-semibold">{title}</h2>
      <p>{description}</p>
    </div>
  );
};

export default EmptyState;