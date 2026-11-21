"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/rbac";

const NotificationIdSchema = z.string().uuid("ID de notification invalide");

export async function markNotificationAsReadAction(notificationId: string) {
  try {
    const validId = NotificationIdSchema.safeParse(notificationId);
    if (!validId.success) {
      return { success: false, message: "ID de notification invalide" };
    }

    const { user } = await requireProfile();
    const supabase = await createClient();

    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", validId.data)
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
