// Shared domain types used across the application

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  created_at: string;
}

export interface Board {
  id: string;
  name: string;
  type: string;
  order_index: number;
  status: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  created_at: string;
  created_by: string;
  status: string;
  is_pinned: boolean;
  board_id: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  status: string;
  board_id: string;
}

export interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

export interface Invitation {
  id: string;
  project_id: string;
  email: string;
  status: string;
  expires_at: string;
  created_at: string;
  project_name?: string;
}
