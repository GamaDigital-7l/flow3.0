session_date).">
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // Added Textarea
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // Added Popover components
import { Calendar } from "@/components/ui/calendar"; // Added Calendar
import { CalendarIcon, Loader2 } from "lucide-react"; // Added CalendarIcon
import { FormControl } from "@/components/ui/form";
import { format } from 'date-fns';
import { cn, convertToSaoPauloTime, convertToUtc, formatDateTime, parseISO } from '@/lib/utils'; // Import parseISO from utils
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMutation, useQueryClient } from "@tanstack/react-query";

// ... (rest of the file)

// Fix error 254, 255
        {form.formState.errors.session_date && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.session_date.message}
          </p>
        )}
// ... (rest of the file)