"use client";

import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PlusCircle, Trash2, CalendarDays, Upload } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { PortfolioProject, PORTFOLIO_CATEGORIES } from "@/types/portfolio";
// Assuming parseISO is available via date-fns or utils
import { format, parseISO } from "date-fns"; 
import { cn, sanitizeFilename } from "@/lib/utils";
import ImageUpload from "../ImageUpload";

// ... (rest of the file)