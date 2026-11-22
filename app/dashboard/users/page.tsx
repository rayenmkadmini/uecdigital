import { requireSuperAdmin } from "@/lib/auth/rbac";
import { getMembers } from "@/lib/data/members";
import { getDepartments } from "@/lib/data/departments";
import { MembersView } from "@/components/members/members-view";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // STRICT SERVER-SIDE RBAC GUARD:
  // Only authenticated users with role === 'SUPER_ADMIN' in the trusted profiles table
  // are allowed to view and manage members. Any unauthorized role is redirected to /dashboard?error=super_admin_required.
  const { profile } = await requireSuperAdmin();

  const [members, departments] = await Promise.all([
    getMembers(),
    getDepartments(),
  ]);

  return (
    <MembersView
      members={members}
      departments={departments}
      currentUserRole={profile.role}
    />
  );
}
