import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Edit, Trash2, CalendarDays, Link as LinkIcon, Users, Tag } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { PortfolioProject } from '@/types/portfolio';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import PortfolioForm from '@/components/portfolio/PortfolioForm';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import ImageGallery from '@/components/ImageGallery';

// ... (rest of the file)

// Fix 58: format usage
<p className="text-sm text-muted-foreground flex items-center gap-1">
    <CalendarDays className="h-4 w-4" /> Concluído em: {format(new Date(project.end_date), 'MMM yyyy', { locale: ptBR })}
</p>
// ... (rest of the file)