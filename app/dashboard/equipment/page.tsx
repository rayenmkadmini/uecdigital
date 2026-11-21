import { requireProfile } from "@/lib/auth/rbac";
import { getEquipmentList } from "@/lib/data/equipment";
import { EquipmentView } from "@/components/equipment/equipment-view";

export const dynamic = "force-dynamic";

export default async function EquipmentPage() {
  const { profile } = await requireProfile();
  const equipment = await getEquipmentList();

  return (
    <EquipmentView
      initialEquipment={equipment}
      userRole={profile.role}
    />
  );
}
