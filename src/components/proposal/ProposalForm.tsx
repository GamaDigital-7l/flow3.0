"use client";

import React, { useState, useMemo } from "react";
// Added UseFormReturn
import { useForm, useFieldArray, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PlusCircle, Trash2, CalendarDays, Users, DollarSign, FileText } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS, ProposalStatus } from "@/types/proposal";
import { Client } from "@/types/client";
import { formatCurrency } from "@/lib/utils";
import ProposalItemForm from "./ProposalItemForm";

// ... (rest of the file)

// Usage fix (Error 44):
// ...
        {/* Itens do Orçamento */}
        <ProposalItemForm form={form as UseFormReturn<ProposalFormValues>} />
// ...