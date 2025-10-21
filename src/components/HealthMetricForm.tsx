"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, convertToUtc } from "@/lib/utils"; // Added convertToUtc
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { FormControl } from "@/components/ui/form"; // Added FormControl

const healthMetricSchema = z.object({
// ... (rest of the file)

  const onSubmit = async (values: HealthMetricFormValues) => {
// ...
    try {
      const dataToSave = {
        date: format(convertToUtc(values.date)!, "yyyy-MM-dd"), // Using convertToUtc
        weight_kg: values.weight_kg || null,
// ...
// ... (rest of the file)