"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/auth/rbac";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole;
  phone?: string | null;
  bio?: string | null;
  is_active: boolean;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail: string): Promise<UserProfile | null> => {
    try {
      const { data: dbProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, phone, bio, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr || !dbProfile) {
        return null;
      }

      const rawProfile = dbProfile as unknown as {
        id: string;
        full_name: string | null;
        role: string;
        avatar_url: string | null;
        phone: string | null;
        bio: string | null;
        is_active: boolean;
      };

      if (!rawProfile.is_active) {
        return null;
      }

      // Fetch department membership
      const { data: deptMember } = await supabase
        .from("department_members")
        .select("department_id, departments(id, name, code)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      const rawDeptMember = deptMember as unknown as {
        department_id: string;
        departments: { id: string; name: string; code: string } | null;
      } | null;

      const loadedProfile: UserProfile = {
        id: rawProfile.id,
        email: userEmail,
        full_name: rawProfile.full_name || userEmail.split("@")[0],
        avatar_url: rawProfile.avatar_url,
        role: rawProfile.role as UserRole,
        phone: rawProfile.phone,
        bio: rawProfile.bio || null,
        is_active: rawProfile.is_active,
        department_id: rawDeptMember?.department_id,
        department_name: rawDeptMember?.departments?.name,
        department_code: rawDeptMember?.departments?.code,
      };

      return loadedProfile;
    } catch (err) {
      console.error("Error fetching trusted profile:", err);
      return null;
    }
  }, [supabase]);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        const userProfile = await fetchProfile(session.user.id, session.user.email || "");
        if (userProfile) {
          setProfile(userProfile);
          setRole(userProfile.role);
        } else {
          // User exists in Auth but profile not ready
          setUser(session.user);
          setProfile(null);
          setRole(null);
        }
      } else {
        // STRICT SECURITY: Unauthenticated users have NULL identity.
        // No client-side demo role or arbitrary cookie is ever trusted.
        setUser(null);
        setProfile(null);
        setRole(null);
      }
    } catch (err) {
      console.error("Error loading auth session:", err);
      setUser(null);
      setProfile(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [supabase, fetchProfile]);

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        const p = await fetchProfile(session.user.id, session.user.email || "");
        if (p) {
          setProfile(p);
          setRole(p.role);
        } else {
          setProfile(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadSession, fetchProfile]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setRole(null);
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user.id, user.email || "");
      if (p) {
        setProfile(p);
        setRole(p.role);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
