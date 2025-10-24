import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Edit, FileText, Clock, Users, DollarSign } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
// Assuming parseISO is available via date-fns or utils
import { format, addDays, isPast } from 'date-fns'; 
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { cn, formatCurrency, formatDateTime } from '@/lib/utils';
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Separator } from '@/components/ui/separator';
import ProposalPortfolioGallery from '@/components/proposal/ProposalPortfolioGallery';

// ... (loadProposalData function)

// ... (rest of the component)

// Fix 56: format usage
{expirationDate && (
    <p>Válido até: {format(expirationDate, "PPP", { locale: ptBR })} ({proposal.validity_days} dias)</p>
)}

// ... (rest of the file)