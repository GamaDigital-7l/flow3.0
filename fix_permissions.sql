-- Grant usage on the public schema to the authenticated role
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges for the authenticated role on the new tables.
-- Your RLS policies will still securely control which rows are visible/modifiable.
GRANT ALL ON TABLE public.recurring_tasks TO authenticated;
GRANT ALL ON TABLE public.recurring_history TO authenticated;