import { useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showError, showSuccess } from '@/utils/toast';
// Removed problematic parseISO import from date-fns, relying on utils.ts
import { format, subDays, isSameDay, getDay, differenceInDays } from 'date-fns'; 
import { parseISO, getTodayLocalString } from '@/lib/utils'; // Usando parseISO e getTodayLocalString do utils
import { Habit, HabitLog } from '@/types/habit';

// ... (rest of the file)