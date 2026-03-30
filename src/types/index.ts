// Shared domain types used across the application

export type BoardType = 'NOTICE' | 'GUIDE' | 'QNA' | 'ALLOCATION' | 'BUG' | 'CUSTOM';
export type BoardStatus = 'ACTIVE' | 'ARCHIVED';
export type PostStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type MembershipStatus = 'ACTIVE' | 'REMOVED';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';
export type AppRole = 'admin' | 'worker';

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  created_at: string;
  created_by: string;
}

export interface Board {
  id: string;
  name: string;
  type: BoardType;
  order_index: number;
  status: BoardStatus;
  project_id: string;
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
  status: PostStatus;
  is_pinned: boolean;
  board_id: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  author_id: string;
  created_at: string;
  status: PostStatus;
  board_id: string;
  data_no?: string | null;
  capture_image_path?: string | null;
  worker_ref?: string | null;
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
  status: InvitationStatus;
  expires_at: string;
  created_at: string;
  project_name?: string;
}
