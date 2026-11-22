import { requireProfile } from "@/lib/auth/rbac";
import { getMediaFiles } from "@/lib/data/media";
import { getDepartments } from "@/lib/data/departments";
import { MediaView } from "@/components/media/media-view";

export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const { profile } = await requireProfile();
  const [files, departments] = await Promise.all([
    getMediaFiles(),
    getDepartments(),
  ]);

  return (
    <MediaView
      initialFiles={files}
      departments={departments}
      userRole={profile.role}
    />
  );
}
