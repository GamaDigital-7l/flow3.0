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
import { CalendarIcon, Loader2, XCircle, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, parseISO, sanitizeFilename, convertToUtc, formatDateTime } from "@/lib/utils"; // Importando parseISO, sanitizeFilename, convertToUtc de utils
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import TagSelector from "../TagSelector";
import { Checkbox } from "../ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import TimePicker from "../TimePicker";

// ... (rest of the file)