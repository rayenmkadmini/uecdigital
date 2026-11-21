import { requireProfile } from "@/lib/auth/rbac";
import { getTasks } from "@/lib/data/tasks";
import { getProjects } from "@/lib/data/projects";
import { getDepartments } from "@/lib/data/departments";
import { getMembers } from "@/lib/data/members";
import { TasksView } from "@/components/tasks/tasks-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { profile } = await requireProfile();

  const [tasks, projects, departments, members] = await Promise.all([
    getTasks(),
    getProjects(),
    getDepartments(),
    getMembers({ isActive: true }),
  ]);

  return (
    <TasksView
      tasks={tasks}
      projects={projects}
      departments={departments}
      members={members}
      userRole={profile.role}
      currentUserId={profile.id}
    />
  );
}
