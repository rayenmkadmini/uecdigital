import { requireProfile } from "@/lib/auth/rbac";
import { getDepartments } from "@/lib/data/departments";
import { DepartmentsView } from "@/components/departments/departments-view";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const { profile } = await requireProfile();
  const departments = await getDepartments();

  return (
    <DepartmentsView
      departments={departments}
      userRole={profile.role}
    />
  );
}
