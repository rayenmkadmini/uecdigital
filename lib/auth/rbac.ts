import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type UserRole = "SUPER_ADMIN" | "COORDINATOR" | "MEMBER";

export interface AuthenticatedUserContext {
  user: User;
  profile: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
    phone: string | null;
    is_active: boolean;
  };
  department: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Retrieves the currently authenticated Supabase user on the server.
 * Returns null if the session is absent or invalid.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * Resolves the authenticated user, their trusted database profile from public.profiles,
 * and their active department membership.
 * Never trusts user_metadata or client-supplied claims.
 */
export async function getCurrentProfile(): Promise<AuthenticatedUserContext | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();

  // 1. Fetch trusted profile from database
  const { data: dbProfile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, role, avatar_url, phone, is_active")
    .eq("id", user.id)
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
    is_active: boolean;
  };

  if (!rawProfile.is_active) {
    return null;
  }

  // 2. Fetch active department membership
  const { data: deptMember } = await supabase
    .from("department_members")
    .select("department_id, departments(id, name, code)")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const rawDeptMember = deptMember as unknown as {
    department_id: string;
    departments: { id: string; name: string; code: string } | null;
  } | null;

  return {
    user,
    profile: {
      id: rawProfile.id,
      full_name: rawProfile.full_name || user.email?.split("@")[0] || "Membre",
      email: user.email || "",
      role: rawProfile.role as UserRole,
      avatar_url: rawProfile.avatar_url,
      phone: rawProfile.phone,
      is_active: rawProfile.is_active,
    },
    department: rawDeptMember?.departments
      ? {
          id: rawDeptMember.departments.id,
          name: rawDeptMember.departments.name,
          code: rawDeptMember.departments.code,
        }
      : null,
  };
}

/**
 * Server Component Guard: Requires an authenticated user.
 * Redirects to /login if unauthenticated.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Server Component Guard: Requires an authenticated user with an active database profile.
 * Redirects to /login if unauthenticated or profile is disabled.
 */
export async function requireProfile(): Promise<AuthenticatedUserContext> {
  const context = await getCurrentProfile();
  if (!context) {
    redirect("/login");
  }
  return context;
}

/**
 * Server Component Guard: Requires the user to have one of the allowed roles.
 * Redirects to /dashboard?denied=role if the user lacks the required role.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthenticatedUserContext> {
  const context = await requireProfile();
  if (!allowedRoles.includes(context.profile.role)) {
    redirect("/dashboard?error=access_denied");
  }
  return context;
}

/**
 * Server Component Guard: Exclusively requires the SUPER_ADMIN role.
 * Used for /dashboard/approvals, /dashboard/users, and core governance.
 */
export async function requireSuperAdmin(): Promise<AuthenticatedUserContext> {
  const context = await requireProfile();
  if (context.profile.role !== "SUPER_ADMIN") {
    redirect("/dashboard?error=super_admin_required");
  }
  return context;
}

/**
 * Server Component Guard: Requires COORDINATOR or SUPER_ADMIN role.
 */
export async function requireCoordinator(
  departmentId?: string
): Promise<AuthenticatedUserContext> {
  const context = await requireProfile();

  if (context.profile.role === "SUPER_ADMIN") {
    return context;
  }

  if (context.profile.role !== "COORDINATOR") {
    redirect("/dashboard?error=coordinator_required");
  }

  if (departmentId && context.department?.id !== departmentId) {
    redirect("/dashboard?error=department_mismatch");
  }

  return context;
}

/**
 * Server Action RBAC Guard: For use inside Server Actions.
 * Throws typed AuthorizationError instead of redirecting.
 */
export async function assertActionSuperAdmin(): Promise<AuthenticatedUserContext> {
  const context = await getCurrentProfile();
  if (!context) {
    throw new AuthorizationError("UNAUTHORIZED: Session manquante ou invalide", 401);
  }
  if (context.profile.role !== "SUPER_ADMIN") {
    throw new AuthorizationError("FORBIDDEN: Action réservée exclusivement au Super Administrateur", 403);
  }
  return context;
}

/**
 * Server Action RBAC Guard: For role-restricted mutations.
 */
export async function assertActionRole(
  allowedRoles: UserRole[]
): Promise<AuthenticatedUserContext> {
  const context = await getCurrentProfile();
  if (!context) {
    throw new AuthorizationError("UNAUTHORIZED: Session manquante ou invalide", 401);
  }
  if (!allowedRoles.includes(context.profile.role)) {
    throw new AuthorizationError(`FORBIDDEN: Rôle requis: ${allowedRoles.join(" ou ")}`, 403);
  }
  return context;
}
