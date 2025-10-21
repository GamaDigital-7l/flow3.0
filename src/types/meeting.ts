export interface Meeting {
  id: string;
  user_id: string;
  title: string;
  description?: string | null;
  date: string; // ISO string (yyyy-MM-dd)
  start_time: string; // HH:mm
  end_time?: string | null; // HH:mm
  location?: string | null;
  google_event_id?: string | null; // Novo campo
  google_html_link?: string | null; // Novo campo
  created_at: string;
  updated_at: string;
}