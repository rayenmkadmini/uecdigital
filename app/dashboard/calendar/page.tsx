import { requireProfile } from "@/lib/auth/rbac";
import { getCalendarItems } from "@/lib/data/calendar";
import { getMembers } from "@/lib/data/members";
import { CalendarView } from "@/components/calendar/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { profile } = await requireProfile();
  const [items, members] = await Promise.all([
    getCalendarItems(),
    getMembers({ isActive: true }),
  ]);

  return (
    <CalendarView
      initialItems={items}
      members={members}
      userRole={profile.role}
    />
  );
}
