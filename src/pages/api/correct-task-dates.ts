import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { convertToSaoPauloTime, convertToUtc, formatISO, parseISO } from '@/lib/utils'; // Importando formatISO e parseISO de utils

// ... (rest of the file)