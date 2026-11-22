import { z } from "zod";

const envSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z
      .string({
        required_error: "NEXT_PUBLIC_SUPABASE_URL est requise pour initialiser l'Espace Digital UEC.",
      })
      .url("NEXT_PUBLIC_SUPABASE_URL doit être une URL valide (ex: https://your-project.supabase.co)"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
      .string()
      .min(10, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY doit comporter au moins 10 caractères")
      .optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z
      .string()
      .min(10, "NEXT_PUBLIC_SUPABASE_ANON_KEY doit comporter au moins 10 caractères")
      .optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  })
  .refine(
    (data) => Boolean(data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || data.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      message:
        "Une clé publique Supabase est requise (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      path: ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    }
  );

export function getPublicEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!result.success) {
    const errorDetails = result.error.errors
      .map((e) => ` - [${e.path.join(".")}]: ${e.message}`)
      .join("\n");
    throw new Error(
      `[UEC CONFIGURATION ERROR] Variables d'environnement requises manquantes ou invalides :\n${errorDetails}\n` +
        `Veuillez configurer vos variables d'environnement dans .env.local ou dans les paramètres Vercel.`
    );
  }

  const data = result.data;
  const publishableKey = (data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    data.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

  return {
    supabaseUrl: data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: publishableKey,
    siteUrl: data.NEXT_PUBLIC_SITE_URL,
  };
}
