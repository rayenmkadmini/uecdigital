import { requireSuperAdmin } from "@/lib/auth/rbac";
import { ApprovalsView } from "@/components/dashboard/approvals-view";

export default async function ApprovalsPage() {
  // STRICT SERVER-SIDE RBAC GUARD:
  // Only authenticated users with role === 'SUPER_ADMIN' in the trusted profiles table
  // are allowed to access this route. Any other role is redirected to /dashboard?error=super_admin_required.
  const authContext = await requireSuperAdmin();

  return <ApprovalsView userEmail={authContext.user.email || ""} />;
}
