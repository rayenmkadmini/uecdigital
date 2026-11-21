import { requireProfile } from "@/lib/auth/rbac";
import { getMeetings } from "@/lib/data/meetings";
import { getDepartments } from "@/lib/data/departments";
import { getMembers } from "@/lib/data/members";
import { MeetingsView } from "@/components/meetings/meetings-view";

export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  const { profile } = await requireProfile();
  const [meetings, departments, members] = await Promise.all([
    getMeetings(),
    getDepartments(),
    getMembers({ isActive: true }),
  ]);

  return (
    <MeetingsView
      initialMeetings={meetings}
      departments={departments}
      members={members}
      userRole={profile.role}
    />
  );
}
