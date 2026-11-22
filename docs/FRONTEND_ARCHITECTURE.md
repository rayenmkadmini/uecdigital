# Architecture Frontend — UEC Espace Digital

**Projet :** UEC — Espace Digital  
**Organisation :** Union des Étudiants Clubistes (Depuis 2021 — *أصحاب الفكرة والعقول*)  
**Phase :** Phase 1 — Frontend Foundation  
**Framework :** Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui principles  
**Gestion d'état & Auth :** Supabase Auth + React Context Provider  
**Internationalisation :** Dictionnaires dynamiques (FR par défaut, AR avec support RTL natif, EN)

---

## 1. Arborescence du Code Source

```
d:/uecdegital/
├── app/
│   ├── layout.tsx                # Root layout (I18nProvider, AuthProvider, Dark tokens)
│   ├── globals.css               # Base Tailwind, variables de couleurs UEC, scrollbars, RTL
│   ├── page.tsx                  # Redirection racine vers /dashboard
│   ├── login/
│   │   └── page.tsx              # Page de connexion officielle (charte UEC, toggles, démo roles)
│   ├── forgot-password/
│   │   └── page.tsx              # Demande de réinitialisation de mot de passe
│   ├── reset-password/
│   │   └── page.tsx              # Définition du nouveau mot de passe
│   ├── auth/callback/
│   │   └── route.ts              # Route handler d'échange de code Supabase Auth
│   └── dashboard/
│       ├── layout.tsx            # Wrapper de l'AppShell pour toutes les sous-routes
│       ├── page.tsx              # Tableau de bord dynamique selon le rôle actif
│       ├── departments/page.tsx  # 6 Pôles Spécialisés du département digital
│       ├── projects/page.tsx     # Gestion des projets, jalons et avancement
│       ├── tasks/page.tsx        # Workflow complet des tâches (Backlog à Done)
│       ├── approvals/page.tsx    # Validation finale exclusive du Super Admin
│       ├── users/page.tsx        # Annuaire des membres, coordinateurs et rôles
│       ├── requests/page.tsx     # Demandes de prestations internes
│       ├── media/page.tsx        # Médiathèque cloud (espace-digital-media)
│       ├── calendar/page.tsx     # Calendrier éditorial sans publication automatique
│       ├── meetings/page.tsx     # Réunions et procès-verbaux (PV)
│       ├── equipment/page.tsx    # Inventaire et gestion des prêts de matériel
│       ├── announcements/page.tsx# Annonces et directives internes officielles
│       ├── analytics/page.tsx    # Métriques de performance et audit
│       └── settings/page.tsx     # Profil utilisateur, langue et préférences
├── components/
│   ├── ui/                       # Composants atomiques SaaS
│   │   ├── button.tsx            # Variantes primary, secondary, danger, outline, cyan
│   │   ├── input.tsx             # Champ dark avec icônes et validation
│   │   ├── badge.tsx             # Badges de rôles et statuts
│   │   ├── card.tsx              # Cartes conteneurs dark
│   │   ├── avatar.tsx            # Initiales ou image de profil
│   │   └── stat-card.tsx         # Cartes KPI avec indicateur de tendance
│   ├── shell/                    # Structure de navigation globale
│   │   ├── app-shell.tsx         # Conteneur responsive avec gestion RTL/LTR
│   │   ├── app-sidebar.tsx       # Sidebar rétractable, logo UEC, sections de navigation
│   │   └── app-header.tsx        # Fil d'Ariane, switch de langue, cloche, menu profil
│   └── dashboard/                # Vues de tableaux de bord spécialisées par rôle
│       ├── super-admin-dashboard.tsx  # Métriques globales, file d'approbation urgente, pôles
│       ├── coordinator-dashboard.tsx  # Pilotage du pôle, membres, revue préalable
│       └── member-dashboard.tsx       # Tâches assignées, modal de soumission de livrables
├── lib/
│   ├── utils.ts                  # Helpers `cn`, formatage de dates
│   ├── i18n/
│   │   └── context.tsx           # Contexte i18n, gestion locale (FR/AR/EN), RTL switch
│   ├── auth/
│   │   └── auth-context.tsx      # Contexte d'authentification Supabase + Banc d'essai démo
│   └── supabase/
│       ├── client.ts             # Client Supabase navigateur (`@supabase/ssr`)
│       ├── server.ts             # Client Supabase serveur (`@supabase/ssr`)
│       └── middleware.ts         # Rafraîchissement des sessions de tokens
├── messages/
│   ├── fr.json                   # Dictionnaire Français (par défaut)
│   ├── ar.json                   # Dictionnaire Arabe (support RTL natif)
│   └── en.json                   # Dictionnaire Anglais
├── public/assets/                # Assets officiels UEC (blason, mascottes, logos, etc.)
└── types/
    └── database.ts               # Types TypeScript générés de la base PostgreSQL
```

---

## 2. Principes Fondamentaux de Conception

### 2.1 Charte Graphique & Dark Theme Premium
- Fond principal : `#0B1020`
- Surfaces secondaires : `#111827`
- Surfaces élevées : `#172033`
- Bordures : `#1F2937` et `#27354F`
- Rouge UEC : `#D62839` (accent de marque et décisions critiques)
- Bleu UEC : `#2563EB` (coordination et actions secondaires)
- Cyan Accent : `#22D3EE` (points d'intérêt et highlights)

### 2.2 Règle d'Or Statutaire : Approbation Finale Super Admin
Le flux opérationnel implémente la séparation stricte :
1. **Membre** : Réalise le travail et soumet le livrable (`SUBMITTED`).
2. **Coordinateur** : Examine la conformité technique du pôle (`COORDINATOR_REVIEW`).
   - S'il valide, il transmet au Super Admin.
   - S'il refuse, il demande une révision au membre.
3. **Super Administrateur** : Seul détenteur du pouvoir de validation finale (`SUPER_ADMIN_APPROVAL` → `APPROVED`).
   - Les boutons de validation définitive ne sont actifs que pour le Super Admin.
   - La base de données PostgreSQL garantit cette règle par RLS et triggers.

### 2.3 Internationalisation Réactive (FR, AR, EN)
- Support de l'écriture et de la disposition bidirectionnelle (RTL pour l'Arabe).
- Persistance dans un cookie `uec_locale` et dans `localStorage`.
- Mise à jour automatique des attributs `html lang` et `html dir`.
