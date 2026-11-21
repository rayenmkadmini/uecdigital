# RAPPORT D'AUDIT DE SÉCURITÉ & D'INTÉGRATION — PHASE 1.1
## Plateforme UEC — Espace Digital

**Organisation :** Union des Étudiants Clubistes (Depuis 2021 — *أصحاب الفكرة والعقول*)  
**Rôle de l'Auditeur :** Senior Application Security Engineer  
**Date de l'Audit :** 21 Novembre 2026  
**Dépôt :** `D:\uecdegital`  
**Branche Git :** `feature/uec-espace-digital`  
**Projet Supabase Distant :** `aigsdarfiplwmzqtqlxh` (PostgreSQL 17.12, eu-west-1)  
**Périmètre de l'Audit :** Code source Frontend Phase 1, Démo Mode, Authentification, Autorisation, RLS & Storage, Inventaire des Mock Data.

---

## 1. Résumé Exécutif (Executive Summary)

À l'issue de l'implémentation de la Phase 1 (Frontend Foundation), un audit approfondi de sécurité applicative et d'intégration a été conduit sur l'ensemble de la codebase.

### Synthèse des Constats
1. **Intégrité de la Base de Données (100% Préservée) :**
   Aucune modification, aucune suppression et aucune migration n'a été appliquée au schéma de production de la base Supabase (`aigsdarfiplwmzqtqlxh`). Les 22 tables, 48 politiques RLS, triggers et le bucket privé `espace-digital-media` sont strictement intacts.
2. **Étanchéité Base de Données / Mode Démo :**
   Grâce aux politiques RLS PostgreSQL toutes restreintes à `TO authenticated`, **aucun utilisateur non authentifié en mode Démo ne peut lire de données réelles, modifier d'enregistrements, valider de livrables ou accéder aux fichiers privés de stockage.**
3. **Vulnérabilité Critique Identifiée (CRIT-01) :**
   Le middleware Next.js (`lib/supabase/middleware.ts`) contient un contournement de redirection d'authentification basé sur le cookie `uec_demo_role`. Tout visiteur non authentifié peut naviguer sur l'ensemble des routes `/dashboard/*` en injectant ce cookie.
4. **Contrôle d'Accès aux Pages (HIGH-01) :**
   Les restrictions de rôle actuelles sont purement déclaratives côté client (masquage de boutons dans React). Il n'existe pas encore de garde de route serveur empêchant un Membre ou un Coordinateur de charger directement l'URL `/dashboard/approvals`.
5. **Données Factices vs Réelles :**
   Toutes les statistiques, projets, tâches et livrables affichés dans les tableaux de bord de la Phase 1 sont des données factices en mémoire (*mock fixtures*). Aucune persistance réelle n'est encore raccordée sur ces composants.

---

## 2. Vulnérabilités Critiques (Critical Vulnerabilities)

### [CRIT-01] Contournement de l'Authentification Middleware via le Cookie Démo
- **Fichier concerné :** `lib/supabase/middleware.ts` (lignes 48-56)
- **CWE :** CWE-287 (Improper Authentication), CWE-306 (Missing Authentication for Critical Function)
- **Description :**
  Le middleware Next.js intercepte les routes `/dashboard/*`. Cependant, il accorde une exemption d'authentification si le cookie `uec_demo_role` est détecté :
  ```typescript
  if (!user && isDashboardRoute) {
    const demoRole = request.cookies.get("uec_demo_role")?.value;
    if (!demoRole) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", request.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
  }
  ```
- **Impact de Sécurité :**
  N'importe quel client HTTP non authentifié peut contourner la page de connexion et accéder au DOM des pages du dashboard en ajoutant simplement l'en-tête `Cookie: uec_demo_role=SUPER_ADMIN`.
- **Atténuation constatée à la base de données :**
  Bien que les pages React s'affichent, les requêtes PostgREST sous-jacentes vers Supabase sont exécutées avec le rôle `anon`. Comme les 22 tables ont RLS activé `TO authenticated`, la base de données renvoie systématiquement des ensembles vides (`[]`) et refuse toute mutation. **Il n'y a donc pas de fuite de données réelles, mais une exposition de l'interface d'administration.**
- **Correction Recommandée :**
  - Isoler le mode Démo derrière une variable d'environnement stricte (`NEXT_PUBLIC_ENABLE_DEMO_MODE=true`), désactivée en production.
  - En production, `middleware.ts` doit exiger `user !== null` de façon inconditionnelle pour toutes les routes `/dashboard/*`.
  - Ne jamais utiliser un cookie client arbitraire pour désactiver une barrière d'authentification.

---

## 3. Risques Élevés (High-Risk Findings)

### [HIGH-01] Absence de Gardes de Rôles Côté Serveur sur les Routes Protégées (RBAC)
- **Fichiers concernés :** `app/dashboard/approvals/page.tsx`, `app/dashboard/users/page.tsx`
- **CWE :** CWE-285 (Improper Authorization)
- **Description :**
  Les routes `/dashboard/approvals` (réservée au Super Admin) et `/dashboard/users` sont des pages clientes (`"use client"`). Elles masquent certains boutons d'action via `isSuperAdmin`, mais autorisent le chargement complet de la page pour n'importe quel rôle (y compris `MEMBER`).
- **Impact :**
  Un membre ordinaire peut afficher l'interface de validation finale, les notes de livrables et la liste des membres en saisissant l'URL directement.
- **Correction Recommandée :**
  Implémenter des `Server Components` ou des vérifications middleware avec `createServerClient()` vérifiant le rôle issu de la table `profiles` avant de rendre ou de rediriger les routes sensibles.

### [HIGH-02] Risque de Patron d'Autorisation Non Sécurisé pour la Phase 2
- **Fichier concerné :** `lib/auth/auth-context.tsx`
- **CWE :** CWE-602 (Client-Side Enforcement of Server-Side Security)
- **Description :**
  Le rôle utilisateur `role` est géré dans le contexte React client. Si les développeurs de la Phase 2 se basent sur `useAuth().role` ou transmettent le rôle via les arguments d'une Server Action ou d'une Route Handler, un utilisateur malveillant pourra usurper n'importe quel rôle en altérant sa requête.
- **Correction Recommandée :**
  Imposer une règle d'architecture stricte pour la Phase 2 : **Toute Server Action et toute Route Handler doit impérativement exécuter son propre contrôle d'identité côté serveur** :
  ```typescript
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("UNAUTHORIZED");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
  ```

---

## 4. Risques Moyens (Medium-Risk Findings)

### [MED-01] Illusion de Persistance & Absence de Distinction Graphique des Données Mock
- **Fichiers concernés :**
  - `components/dashboard/super-admin-dashboard.tsx`
  - `components/dashboard/coordinator-dashboard.tsx`
  - `components/dashboard/member-dashboard.tsx`
- **Description :**
  Les actions comme "Valider Définitivement", "Demander Révision" ou "Soumettre un Livrable" modifient un état React local (`useState`) et affichent des bannières de succès en vert. Aucune requête n'est transmise à la base de données.
- **Impact :**
  Un responsable opérationnel ou testeur non-technique peut croire qu'une approbation a été enregistrée alors qu'un simple rafraîchissement de page réinitialise l'état.
- **Correction Recommandée :**
  Afficher un badge d'avertissement visible : *"Mode Démonstration : données factices non enregistrées en base"* tant que le mode Démo est actif.

### [MED-02] Absence de Configuration ESLint dans le Dépôt
- **Description :**
  L'exécution de `npm run lint` échoue avec le code de sortie 1 en environnement non-interactif car Next.js 15 requiert une configuration ESLint explicite (`.eslintrc.json` ou `eslint.config.mjs`).
- **Correction Recommandée :**
  Créer un fichier de configuration `.eslintrc.json` étendant `"next/core-web-vitals"`.

---

## 5. Audit Approfondi de l'Authentification

| Composant | Mécanisme / Endpoint | Statut de Sécurité | Remarques |
|---|---|:---:|---|
| **Connexion** | `supabase.auth.signInWithPassword` | **Conforme** | Mots de passe transmis en HTTPS, vérification par Supabase GoTrue. |
| **Déconnexion** | `supabase.auth.signOut` | **Conforme** | Invalidation de session et purge des cookies côté client. |
| **Persistance de Session** | Cookies gérés par `@supabase/ssr` | **Conforme** | `SameSite=Lax`, `path=/`, rafraîchissement automatique dans `middleware.ts`. |
| **Callback OAuth / Magic Link** | `/auth/callback/route.ts` | **Conforme** | Utilise `exchangeCodeForSession(code)` côté serveur. |
| **Récupération Mot de Passe** | `resetPasswordForEmail` + `/reset-password` | **Conforme** | Exige minimum 8 caractères et confirmation identique. |
| **Rafraîchissement Token** | `updateSession(request)` | **Conforme** | Appelle `supabase.auth.getUser()` pour valider et renouveler le JWT. |
| **Garde Middleware** | `middleware.ts` | **À Corriger** | Bipassé si le cookie `uec_demo_role` est présent (voir CRIT-01). |

---

## 6. Audit Approfondi des Rôles & Autorisations

### 6.1 Test des Trois Rôles Opérationnels

| Rôle | Test d'Autorisation Frontend | Test d'Autorisation Base de Données | Évaluation |
|---|---|---|---|
| **SUPER_ADMIN** | Affiche tous les modules, boutons de validation finale actifs. | Trigger `check_task_submission_approval` autorise la validation. Trigger `prevent_role_escalation` autorise la modification de rôles. | **Robuste en DB** (Verrouillé par trigger) |
| **COORDINATOR** | Masque les boutons d'approbation finale sur `/dashboard/approvals`, affiche les boutons de revue d'équipe. | Si un coordinateur tente un `UPDATE task_submissions SET status = 'APPROVED'`, le trigger `check_task_submission_approval` lève l'exception `APPROVAL_VIOLATION`. | **Robuste en DB** (Impossible de forcer l'approbation) |
| **MEMBER** | Affiche ses tâches et le modal de soumission. Ne peut pas approuver. | Si un membre tente de modifier `role` dans `profiles`, le trigger `prevent_role_escalation` lève l'exception `SECURITY_VIOLATION`. | **Robuste en DB** (Impossible de s'auto-promouvoir) |

### 6.2 Sécurité de l'Approbation Finale (Règle Statutaire UEC)
- La règle statutaire : *"Final approval authority: SUPER ADMIN ONLY"* est **parfaitement appliquée au niveau PostgreSQL**.
- Même si un attaquant modifie le code JavaScript du navigateur pour forcer l'envoi d'une requête d'approbation, la base de données distante rejette la transaction instantanément.

---

## 7. Audit du Mode Démo (Demo Mode Isolation)

| Question d'Audit | Résultat Réel | Analyse Technique |
|---|:---:|---|
| Le mode démo peut-il accéder aux pages du dashboard ? | **OUI** | Par conception temporaire de la Phase 1, le cookie `uec_demo_role` est accepté par `middleware.ts`. |
| Le mode démo peut-il lire les données réelles de Supabase ? | **NON** | Les requêtes sans JWT utilisateur sont évaluées sous le rôle `anon`. Toutes les tables ont RLS `TO authenticated`. |
| Le mode démo peut-il exécuter des mutations en base ? | **NON** | Aucune politique `INSERT`, `UPDATE` ou `DELETE` n'est accordée à `anon`. |
| Le mode démo peut-il approuver/rejeter des livrables réels ? | **NON** | Rejeté par RLS et par le trigger `check_task_submission_approval()`. |
| Le mode démo peut-il modifier les utilisateurs ou rôles ? | **NON** | Rejeté par RLS et par le trigger `prevent_role_escalation()`. |
| Le mode démo peut-il accéder aux fichiers privés de stockage ? | **NON** | Le bucket `espace-digital-media` est privé (`public = false`) et RLS bloque tout accès `anon`. |

---

## 8. Audit des Politiques RLS & Supabase Storage

### 8.1 Inventaire des Politiques RLS (Inspection non-destructive)
- **Tables protégées :** 22 tables sur 22 (`rowsecurity = true`).
- **Politiques actives :** 48 politiques réparties selon les permissions documentées dans `docs/ROLE_PERMISSIONS.md`.
- **Isolation inter-pôles :**
  - Les membres ne peuvent consulter que les projets et tâches liés à leur département (via jointure avec `department_members`).
  - Les coordinateurs ont la visibilité sur l'ensemble de leur département.
  - Le Super Admin dispose d'une visibilité globale transverse.

### 8.2 Bucket de Stockage Privé (`espace-digital-media`)
- **Visibilité :** `public = false`.
- **Taille maximale par fichier :** 52 428 800 octets (50 MB).
- **MIME types :** Restreints aux formats multimédias et documents usuels.
- **Politiques de stockage RLS :**
  - `media_storage_select_dept` : Lecture autorisée uniquement aux membres du même pôle ou au Super Admin.
  - `media_storage_insert_dept` : Écriture autorisée uniquement avec préfixe de dossier correspondant au pôle de l'utilisateur.
  - `media_storage_delete_admin_coord` : Suppression réservée au coordinateur du pôle ou au Super Admin.

---

## 9. Inventaire Exhaustif des Données Factices (Mock Data Inventory)

Pour préparer le raccordement de la Phase 2, voici l'inventaire précis de toutes les données factices actuellement codées en dur dans le frontend :

| Module / Page | Données Factices Identifiées | Variable / Constante Source | Action Requise en Phase 2 |
|---|---|---|---|
| **Super Admin Dashboard** | 3 approbations factices, 6 départements avec jauges statiques, 4 stats KPI ("15", "34", "1.8 GB") | `MOCK_PENDING_APPROVALS`, `DEPARTMENTS` | Remplacer par requêtes `task_submissions` (`status = 'SUPER_ADMIN_APPROVAL'`) et agrégations SQL |
| **Coordinator Dashboard** | 2 livrables factices d'équipe, 4 membres d'équipe, stats factices | `MOCK_TEAM_SUBMISSIONS`, `MOCK_TEAM_MEMBERS` | Remplacer par requête sur `department_members` et `task_submissions` filtrées sur le `department_id` |
| **Member Dashboard** | 3 tâches assignées factices, stats factices | `MOCK_MEMBER_TASKS` | Remplacer par requête sur `tasks` jointes avec `task_assignees` pour `user_id = auth.uid()` |
| **Départements** | 6 fiches pôles avec compteurs statiques | `DEPARTMENTS_DATA` | Remplacer par `supabase.from('departments').select('*, department_members(count), projects(count)')` |
| **Projets** | 4 projets factices | `PROJECTS_DATA` | Remplacer par `supabase.from('projects').select('*')` |
| **Tâches** | 5 tâches factices | `TASKS_DATA` | Remplacer par `supabase.from('tasks').select('*')` |
| **Approbations** | 2 dossiers factices | `INITIAL_APPROVALS` | Remplacer par requête temps réel `task_submissions` avec historique `approval_history` |
| **Membres / Utilisateurs** | 7 faux membres avec adresses fictives | `MEMBERS_DATA` | Remplacer par `supabase.from('profiles').select('*, department_members(*)')` |
| **Demandes Internes** | 3 demandes factices | `REQUESTS_DATA` | Remplacer par `supabase.from('service_requests').select('*')` |
| **Médiathèque** | 4 assets locaux pointant vers `/assets/*.webp` | `MEDIA_FILES` | Remplacer par `supabase.storage.from('espace-digital-media').list()` et `media_files` |
| **Calendrier** | 3 publications factices | `CALENDAR_ENTRIES` | Remplacer par `supabase.from('content_calendar').select('*')` |
| **Réunions** | 2 réunions factices | Array local `meetings` | Remplacer par `supabase.from('meetings').select('*')` |
| **Matériel** | 4 équipements avec faux numéros de série | Array local `items` | Remplacer par `supabase.from('equipment_inventory').select('*')` |
| **Annonces** | 2 annonces factices | Array local `announcements` | Remplacer par `supabase.from('announcements').select('*')` |
| **Analytics** | KPIs ("82.4%", "3.4h", "1,420") et taux de livraison | Array local `deptPerformance` | Remplacer par vues ou fonctions RPC PostgreSQL agrégées |

---

## 10. Tests Effectués & Résultats Réels

| Commande / Test | Outil | Résultat | Détails / Code de Sortie |
|---|---|:---:|---|
| `npx tsc --noEmit` | TypeScript Compiler 5.6.3 | ✅ **SUCCÈS** | Code 0. Aucune erreur de typage sur l'ensemble des 94 fichiers. |
| `npm run lint` | Next.js Lint | ⚠️ **ATTENTION** | Code 1. Next.js 15 demande la sélection d'un gabarit ESLint (`.eslintrc.json`). |
| `npm run build` | Next.js 15 Production Build | ✅ **SUCCÈS** | Code 0. 22 pages statiques et dynamiques compilées sans erreur en 10.6s. |
| Simulation élévation rôle | Trigger PL/pgSQL | ✅ **SUCCÈS** | `SECURITY_VIOLATION` intercepté côté base. |
| Simulation approbation coord | Trigger PL/pgSQL | ✅ **SUCCÈS** | `APPROVAL_VIOLATION` intercepté côté base. |

---

## 11. Plan de Remédiation Recommandé (Ordonné par Priorité)

### Priorité 1 : Critique (Avant Déploiement en Production)
1. **Sécurisation du Middleware (`CRIT-01`) :**
   Conditionner la lecture du cookie `uec_demo_role` à la présence de la variable `NEXT_PUBLIC_ENABLE_DEMO_MODE === "true"`. Si la variable est absente ou `"false"`, exiger impérativement une session Supabase active (`user !== null`) pour toutes les routes `/dashboard/*`.

### Priorité 2 : Élevée (Au Démarrage de la Phase 2)
2. **Garde de Rôles Serveur (`HIGH-01`) :**
   Créer un helper serveur réutilisable `requireRole(allowedRoles: UserRole[])` ou un composant serveur `<ServerRoleGuard>` vérifiant le profil dans `profiles` avant de rendre les routes `/dashboard/approvals`, `/dashboard/users` et les paramètres avancés.
3. **Architecture des Server Actions & API (`HIGH-02`) :**
   Établir comme règle obligatoire que chaque Server Action de mutation ou de requête sensible ré-authentifie l'utilisateur via `supabase.auth.getUser()` et résolve son rôle en base, sans jamais faire confiance aux paramètres clients.

### Priorité 3 : Moyenne (Hygiène & Ergonomie)
4. **Configuration ESLint (`MED-02`) :**
   Ajouter `.eslintrc.json` avec la configuration recommandée pour Next.js 15 afin d'automatiser les lints dans la CI/CD.
5. **Indicateur Visuel de Données Démo (`MED-01`) :**
   Ajouter une mention discrète sur les cartes de données factices pour expliciter qu'il s'agit de gabarits de présentation en attente du raccordement Phase 2.

---

## 12. Conclusion de l'Ingénieur Sécurité

La fondation de la Phase 1 est **techniquement saine, robuste côté base de données et parfaitement alignée avec la règle d'or statutaire de l'UEC (approbation finale exclusive par le Super Admin).**

Le mécanisme de "Demo Mode" a permis de valider l'ergonomie multi-rôles et le rendu RTL/LTR sans polluer la base de données. Cependant, avant toute mise en ligne publique, les corrections de Priorité 1 (neutralisation du contournement middleware en production) doivent être formalisées.

**Le projet est prêt à recevoir le feu vert pour la Phase 2 (intégration des données réelles et persistance Supabase).**
