"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type UserRole = "SUPER_ADMIN" | "COORDINATOR" | "MEMBER";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  role: UserRole;
  phone?: string | null;
  is_active: boolean;
  department_id?: string | null;
  department_name?: string | null;
  department_code?: string | null;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  isDemoMode: boolean;
  setDemoRole: (role: UserRole) => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const DEMO_PROFILES: Record<UserRole, UserProfile> = {
  SUPER_ADMIN: {
    id: "demo-super-admin-001",
    email: "superadmin@uec.tn",
    full_name: "Yassine Ben Salem (Super Admin)",
    role: "SUPER_ADMIN",
    is_active: true,
    department_name: "Direction Digitale",
    department_code: "EXECUTIVE",
  },
  COORDINATOR: {
    id: "demo-coordinator-002",
    email: "coordinateur.design@uec.tn",
    full_name: "Nourhene Trabelsi (Coordinatrice)",
    role: "COORDINATOR",
    is_active: true,
    department_name: "Pôle Créatif & Design",
    department_code: "DESIGN",
  },
  MEMBER: {
    id: "demo-member-003",
    email: "membre.video@uec.tn",
    full_name: "Ahmed Karray (Membre)",
    role: "MEMBER",
    is_active: true,
    department_name: "Pôle Audiovisuel & Montage",
    department_code: "VIDEO",
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<UserRole>("SUPER_ADMIN");
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);

  const fetchProfile = useCallback(async (userId: string, userEmail: string) => {
    try {
      const { data: dbProfile, error: profileErr } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url, phone, is_active")
        .eq("id", userId)
        .maybeSingle();

      if (profileErr || !dbProfile) {
        console.warn("Could not fetch database profile, falling back:", profileErr);
        return null;
      }

      const rawProfile = dbProfile as unknown as {
        id: string;
        full_name: string | null;
        role: string;
        avatar_url: string | null;
        phone: string | null;
        is_active: boolean;
      };

      // Fetch department
      const { data: deptMember } = await supabase
        .from("department_members")
        .select("department_id, departments(name, code)")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();

      const rawDeptMember = deptMember as unknown as {
        department_id: string;
        departments: { name: string; code: string } | null;
      } | null;

      const loadedProfile: UserProfile = {
        id: rawProfile.id,
        email: userEmail,
        full_name: rawProfile.full_name || userEmail.split("@")[0],
        avatar_url: rawProfile.avatar_url,
        role: rawProfile.role as UserRole,
        phone: rawProfile.phone,
        is_active: rawProfile.is_active,
        department_id: rawDeptMember?.department_id,
        department_name: rawDeptMember?.departments?.name,
        department_code: rawDeptMember?.departments?.code,
      };

      return loadedProfile;
    } catch (err) {
      console.error("Error in fetchProfile:", err);
      return null;
    }
  }, [supabase]);

  const loadSession = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        setIsDemoMode(false);
        const userProfile = await fetchProfile(session.user.id, session.user.email || "");
        if (userProfile) {
          setProfile(userProfile);
          setRole(userProfile.role);
        } else {
          const defaultProf: UserProfile = {
            id: session.user.id,
            email: session.user.email || "",
            full_name: session.user.email?.split("@")[0] || "Membre UEC",
            role: "MEMBER",
            is_active: true,
          };
          setProfile(defaultProf);
          setRole("MEMBER");
        }
      } else {
        const savedDemoRole = (typeof window !== "undefined"
          ? (localStorage.getItem("uec_demo_role") || "SUPER_ADMIN")
          : "SUPER_ADMIN") as UserRole;

        const effectiveRole = ["SUPER_ADMIN", "COORDINATOR", "MEMBER"].includes(savedDemoRole)
          ? savedDemoRole
          : "SUPER_ADMIN";

        setUser(null);
        setIsDemoMode(true);
        setRole(effectiveRole);
        setProfile(DEMO_PROFILES[effectiveRole]);
      }
    } catch (err) {
      console.error("Error loading session:", err);
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
        setIsDemoMode(false);
        const p = await fetchProfile(session.user.id, session.user.email || "");
        if (p) {
          setProfile(p);
          setRole(p.role);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadSession, fetchProfile]);

  const setDemoRole = (newRole: UserRole) => {
    setIsDemoMode(true);
    setRole(newRole);
    setProfile(DEMO_PROFILES[newRole]);
    if (typeof window !== "undefined") {
      localStorage.setItem("uec_demo_role", newRole);
      document.cookie = `uec_demo_role=${newRole}; path=/; max-age=604800; SameSite=Lax`;
    }
  };

  const signOut = async () => {
    if (user) {
      await supabase.auth.signOut();
    }
    if (typeof window !== "undefined") {
      localStorage.removeItem("uec_demo_role");
      document.cookie = "uec_demo_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      window.location.href = "/login";
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
        isDemoMode,
        setDemoRole,
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
