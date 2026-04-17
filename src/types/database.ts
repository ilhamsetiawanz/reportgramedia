export type UserRole = "store_manager" | "supervisor" | "store_associate";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  supervisor_id: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  supervisor_id: string | null;
  is_active: boolean;
  created_at: string;
}

// Tambahkan interface lain sesuai kebutuhan di tahap selanjutnya (Revenue, Target, dll)
