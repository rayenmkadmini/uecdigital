"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/rbac";

export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const { user } = await requireProfile();
    const supabase = await createClient();

    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("user_id", user.id);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

export async function markAllNotificationsAsReadAction() {
  try {
    const { user } = await requireProfile();
    const supabase = await createClient();

    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}
