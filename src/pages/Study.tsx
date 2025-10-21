import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CheckCircle2, CalendarDays, Clock } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn, formatDateTime, formatTime } from "@/lib/utils";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";
import StudySessionForm, { StudySessionFormValues } from "@/components/StudySessionForm";
import { Checkbox } from "@/components/ui/checkbox";

interface StudySession extends Omit<StudySessionFormValues, 'session_date'> {
// ... (rest of the file)