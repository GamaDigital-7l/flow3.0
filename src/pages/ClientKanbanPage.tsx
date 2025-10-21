"use client";

import React from 'react';

interface ClientKanbanPageProps {
  client: any;
  monthYearRef: string;
}

const ClientKanbanPage: React.FC<ClientKanbanPageProps> = ({ client, monthYearRef }) => {
  return (
    <div>
      <h2>Client Kanban Board</h2>
      <p>Client ID: {client?.id}</p>
      <p>Month/Year: {monthYearRef}</p>
    </div>
  );
};

export default ClientKanbanPage;