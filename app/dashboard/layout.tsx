import React from "react";
import { requireProfile } from "@/lib/auth/rbac";
import { AppShell } from "@/components/shell/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side authentication and active profile enforcement
  await requireProfile();

  return <AppShell>{children}</AppShell>;
}
