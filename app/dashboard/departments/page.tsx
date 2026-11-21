import { requireProfile } from "@/lib/auth/rbac";
import { getDepartments } from "@/lib/data/departments";
import { getMembers } from "@/lib/data/members";
import { DepartmentsView } from "@/components/departments/departments-view";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const { profile } = await requireProfile();
  const [departments, members] = await Promise.all([
    getDepartments(),
    getMembers({ isActive: true }),
  ]);

  return (
    <DepartmentsView
      departments={departments}
      members={members}
      userRole={profile.role}
    />
  );
}
