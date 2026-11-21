import { requireProfile } from "@/lib/auth/rbac";
import { getServiceRequests } from "@/lib/data/requests";
import { getDepartments } from "@/lib/data/departments";
import { RequestsView } from "@/components/requests/requests-view";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const { profile } = await requireProfile();
  const [requests, departments] = await Promise.all([
    getServiceRequests(),
    getDepartments(),
  ]);

  return (
    <RequestsView
      initialRequests={requests}
      departments={departments}
      userRole={profile.role}
    />
  );
}
