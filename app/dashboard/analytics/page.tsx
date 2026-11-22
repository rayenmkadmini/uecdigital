import { requireProfile } from "@/lib/auth/rbac";
import { getAnalyticsData } from "@/lib/data/analytics";
import { AnalyticsView } from "@/components/analytics/analytics-view";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { profile } = await requireProfile();
  const data = await getAnalyticsData();

  return (
    <AnalyticsView
      data={data}
      userRole={profile.role}
    />
  );
}
