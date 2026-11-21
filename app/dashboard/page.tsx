import { requireProfile } from "@/lib/auth/rbac";
import {
  getSuperAdminDashboardData,
  getCoordinatorDashboardData,
  getMemberDashboardData,
} from "@/lib/data/dashboard";
import { SuperAdminDashboard } from "@/components/dashboard/super-admin-dashboard";
import { CoordinatorDashboard } from "@/components/dashboard/coordinator-dashboard";
import { MemberDashboard } from "@/components/dashboard/member-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, department } = await requireProfile();

  if (profile.role === "SUPER_ADMIN") {
    const data = await getSuperAdminDashboardData();
    return <SuperAdminDashboard data={data} />;
  }

  if (profile.role === "COORDINATOR") {
    const data = await getCoordinatorDashboardData(
      department?.id || "",
      department?.name || "Pôle Digital Spécialisé",
      department?.code || "UEC"
    );
    return <CoordinatorDashboard data={data} />;
  }

  // Default: MEMBER role
  const data = await getMemberDashboardData(profile.id);
  return (
    <MemberDashboard
      data={data}
      userName={profile.full_name || "Membre UEC"}
      departmentName={department?.name || "Département Digital"}
    />
  );
}
