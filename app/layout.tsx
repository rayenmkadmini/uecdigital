import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";
import { AuthProvider } from "@/lib/auth/auth-context";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "UEC — Espace Digital | Union des Étudiants Clubistes",
  description:
    "Plateforme d'administration et de gestion opérationnelle du Pôle Digital de l'Union des Étudiants Clubistes (Depuis 2021 — أصحاب الفكرة والعقول).",
  icons: {
    icon: "/assets/favicon-64.png",
    apple: "/assets/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" dir="ltr" className="dark">
      <head>
        <link rel="icon" href="/assets/favicon-64.png" sizes="any" />
      </head>
      <body className="bg-[#0B1020] text-slate-100 min-h-screen antialiased">
        <I18nProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
