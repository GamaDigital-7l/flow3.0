"use client";

import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleDeepLink = () => {
      const path = window.location.pathname;
      const search = window.location.search;

      if (path.startsWith('/tasks') && search.includes('action=new')) {
        navigate('/tasks', { state: { openNewTaskForm: true } });
      } else if (path.startsWith('/clients') && search.includes('openTaskId=')) {
        const taskId = new URLSearchParams(search).get('openTaskId');
        const clientId = path.split('/')[2];
        if (clientId && taskId) {
          navigate(`/clients/${clientId}?openTaskId=${taskId}`);
        }
      }
    };

    handleDeepLink();
    window.addEventListener('popstate', handleDeepLink);
    return () => window.removeEventListener('popstate', handleDeepLink);
  }, [navigate, location]);

  return null; // This component does not render anything visible
};

export default DeepLinkHandler;