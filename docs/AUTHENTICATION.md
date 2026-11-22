# Architecture d'Authentification & Rôles — UEC Espace Digital

## 1. Principes de Sécurité & Gestion des Sessions

L'authentification de l'Espace Digital repose sur **Supabase Auth** avec synchronisation des sessions via `@supabase/ssr`.

### Identifiants et Clés
- `NEXT_PUBLIC_SUPABASE_URL`: Point de terminaison HTTPS sécurisé vers le projet distant `aigsdarfiplwmzqtqlxh`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Clé publique client (anon key).
- Aucune clé de service (`service_role`) n'est exposée côté frontend.

### Flux de Session
1. `middleware.ts` intercepte chaque requête, rafraîchit le token JWT dans les cookies via `updateSession()`.
2. Le contexte React `AuthProvider` écoute `supabase.auth.onAuthStateChange`.
3. Dès qu'un utilisateur est authentifié, son profil officiel est récupéré directement depuis la table `public.profiles` :
   - `id`: Référence foreign key vers `auth.users(id)`
   - `role`: Type énuméré PostgreSQL `SUPER_ADMIN | COORDINATOR | MEMBER`
   - `is_active`: Statut d'activation du compte
4. L'appartenance au pôle est résolue via la table de liaison `public.department_members` pointant vers `public.departments`.

---

## 2. Les Trois Rôles Opérationnels

| Rôle | Périmètre d'Autorité | Responsabilités Principales |
|---|---|---|
| **SUPER_ADMIN** | Tout le département | Autorité exclusive de validation finale, arbitrage, création de pôles, gestion des accès. |
| **COORDINATOR** | Pôle spécifique | Organisation de l'équipe, création des tâches de pôle, revue préalable des livrables. |
| **MEMBER** | Ses tâches assignées | Réalisation des travaux, soumission des livrables pour revue. |

---

## 3. Banc d'Essai Multi-Rôles (Mode Démo)

Pour permettre au client et aux testeurs d'évaluer l'ensemble des parcours utilisateurs sans avoir à créer au préalable des comptes dans Supabase Auth, la plateforme intègre un **Banc d'Essai Démo** :
- Un bandeau en tête de tableau de bord permet de basculer instantanément entre :
  - **Super Admin** : `Yassine Ben Salem (Super Admin)`
  - **Coordinateur** : `Nourhene Trabelsi (Pôle Design)`
  - **Membre** : `Ahmed Karray (Pôle Vidéo)`
- Le rôle sélectionné est persisté via un cookie `uec_demo_role`.
- Dès qu'une connexion réelle via email/mot de passe est effectuée sur `/login`, le compte réel prend la priorité absolue.
