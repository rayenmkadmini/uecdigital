import { requireProfile } from "@/lib/auth/rbac";
import { getProjects } from "@/lib/data/projects";
import { getDepartments } from "@/lib/data/departments";
import { getMembers } from "@/lib/data/members";
import { ProjectsView } from "@/components/projects/projects-view";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { profile } = await requireProfile();

  const [projects, departments, members] = await Promise.all([
    getProjects(),
    getDepartments(),
    getMembers({ isActive: true }),
  ]);

  return (
    <ProjectsView
      projects={projects}
      departments={departments}
      members={members}
      userRole={profile.role}
      currentUserId={profile.id}
    />
  );
}
