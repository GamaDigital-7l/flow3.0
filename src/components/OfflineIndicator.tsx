"use client";

import React from 'react';
import { WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OfflineIndicatorProps {
  isOnline: boolean;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ isOnline }) => {
  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-[calc(4rem+var(--sat))] left-0 right-0 z-50 bg-red-600 text-white p-2 text-center text-sm flex items-center justify-center gap-2 shadow-md"
        >
          <WifiOff className="h-4 w-4" />
          Você está offline. Algumas funcionalidades podem estar limitadas.
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;