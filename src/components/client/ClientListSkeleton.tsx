import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const ClientListSkeleton: React.FC = () => {
  return (
    <div className="space-y-3 p-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border">
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-7 w-7 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ClientListSkeleton;