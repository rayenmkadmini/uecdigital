import { requireSuperAdmin } from "@/lib/auth/rbac";
import { UsersView } from "@/components/dashboard/users-view";

export default async function UsersPage() {
  // STRICT SERVER-SIDE RBAC GUARD:
  // Only authenticated users with role === 'SUPER_ADMIN' in the trusted profiles table
  // are allowed to view and manage members. Any unauthorized role is redirected to /dashboard?error=super_admin_required.
  await requireSuperAdmin();

  return <UsersView />;
}
