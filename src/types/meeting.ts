export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  date: string; // ISO string (yyyy-MM-dd)
  start_time: string; // HH:mm
  end_time?: string | null; // HH:mm
  location?: string | null;
  created_at: string;
  updated_at: string;
}