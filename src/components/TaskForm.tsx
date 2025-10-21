import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format, isSameDay } from "date-fns";
import { formatDateTime, convertToSaoPauloTime, convertToUtc, formatISO, parseISO } from "@/lib/utils"; // Importando formatISO e parseISO de utils
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import TagSelector from "./TagSelector";
import TimePicker from "./TimePicker";
import { ptBR } from "date-fns/locale/pt-BR";
import { TaskRecurrenceType } from "@/types/task";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import TaskScheduling from "./task/TaskScheduling";

// ... (rest of the file)

// Inside onSubmit function:
// ...
      } else {
        const { data, error } = await supabase.from("tasks").insert({
          ...dataToSave,
          user_id: userId,
          created_at: formatISO(convertToSaoPauloTime(new Date())!), // Usando formatISO de utils
        }).select("id").single();
// ...