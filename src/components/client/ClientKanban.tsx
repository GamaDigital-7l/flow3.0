// src/components/client/ClientKanban.tsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, Repeat, CalendarDays, Lock, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskForm from './ClientTaskForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTaskTemplates from './ClientTaskTemplates';
import ClientVault from './ClientVault';
import ClientKanbanHeader from './ClientKanbanHeader';
import ClientKanbanBoard from './ClientKanbanBoard';
import { useClientKanban } from '@/hooks/useClientKanban';
import { ClientTaskStatus, ClientTask } from '@/types/client';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button'; // Importação adicionada

type TabValue = "kanban" | "templates" | "vault";

const ClientKanban: React.FC = () => {
// ... restante do código