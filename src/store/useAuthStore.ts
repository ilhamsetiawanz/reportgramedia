import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { UserProfile } from "../types/database";
import { Session } from "@supabase/supabase-js";

interface AuthState {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  
  setSession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  error: null,

  setSession: async (session) => {
    set({ session, isLoading: !!session, error: null });
    
    if (session?.user) {
      await get().fetchProfile(session.user.id);
    } else {
      set({ profile: null, isLoading: false });
    }
  },

  fetchProfile: async (userId) => {
    try {
      // We set isLoading only if it's not already true
      if (!get().isLoading) set({ isLoading: true });

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle(); // Use maybeSingle to avoid error if row doesn't exist yet

      if (error) throw error;
      
      set({ profile: data as UserProfile, isLoading: false, error: null });
    } catch (err: any) {
      console.error("Error fetching profile:", err.message);
      set({ profile: null, isLoading: false, error: err.message });
    }
  },

  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      // Clear EVERYTHING explicitly
      set({ session: null, profile: null, isLoading: false, error: null });
      // Redirect to signin will be handled by ProtectedRoute
    } catch (err: any) {
      console.error("Sign out error:", err.message);
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
