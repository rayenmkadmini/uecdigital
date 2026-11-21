import { requireProfile } from "@/lib/auth/rbac";
import { getAnnouncements } from "@/lib/data/announcements";
import { getDepartments } from "@/lib/data/departments";
import { AnnouncementsView } from "@/components/announcements/announcements-view";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const { profile } = await requireProfile();
  const [announcements, departments] = await Promise.all([
    getAnnouncements(),
    getDepartments(),
  ]);

  return (
    <AnnouncementsView
      initialAnnouncements={announcements}
      departments={departments}
      userRole={profile.role}
    />
  );
}
