# PLAN D'IMPLÉMENTATION — UEC ESPACE DIGITAL
**Système d'Exploitation du Département Digital de l'Union des Étudiants Clubistes**  
**Branche Git de Référence :** `feature/uec-espace-digital`  
**Méthodologie :** Audit First → Architecture & Schéma → Implémentation Modulaire → Sécurité & RLS → Tests & Recette

---

## 1. Vue d'Ensemble & Objectifs Stratégiques

Ce plan d'implémentation détaille la trajectoire technique pour livrer une plateforme interne SaaS complète, sécurisée, hautement disponible et ergonomique pour l'organisation **UEC**. 

### Décisions d'Organisation Non-Négociables :
1. **Organisation par Équipes Spécialisées :** 6 départements initiaux configurables par le Super Admin.
2. **Autorité Exclusive d'Approbation Finale :** SUPER ADMIN SEULEMENT. Aucun Coordinateur ne peut approuver un livrable officiel.
3. **Trilinguisme Intégral :** Français (par défaut) + العربية (avec affichage RTL natif) + Anglais.
4. **Zéro Régression & Zéro Altération de l'Existant :** Conservation intégrale de l'écosystème UEC existant.

---

## 2. Matrice des Phases d'Implémentation

```
Phase 0: Audit & Cadrage (Terminé)
   │
   ▼
Phase 1: Socle Applicatif, Schéma DB, Authentification & Rôles
   │
   ▼
Phase 2: Gestion des Départements, Projets & Tâches (Kanban)
   │
   ▼
Phase 3: Moteur de Soumission & Approbation Finale Super Admin
   │
   ▼
Phase 4: Modules Organisationnels (Requêtes, Calendrier, Médias, Matériel, Réunions)
   │
   ▼
Phase 5: Dashboards Analytiques, Rapports & Journalisation d'Audit
   │
   ▼
Phase 6: Assurance Qualité, Tests Automatisés, Audit Sécurité & Documentation
```

---

## 3. Détail des Phases & Critères d'Acceptation

### PHASE 0 — AUDIT & CADRAGE TECHNIQUE (TERMINÉE)
- **Objectif :** Examiner le dépôt existant `rayenmkadmini/uec`, cartographier les tables, identifier la stack et neutraliser tout risque d'incompatibilité ou de régression.
- **Livrables :**
  - `docs/ESPACE_DIGITAL_AUDIT.md` (Complet)
  - `docs/ESPACE_DIGITAL_IMPLEMENTATION_PLAN.md` (Complet)
  - Création de la branche isolée `feature/uec-espace-digital`.
- **Critères d'acceptation :** Cartographie exhaustive validée, zéro impact sur la production existante.

---

### PHASE 1 — SOCLE APPLICATIF, SCHÉMA DB, AUTHENTIFICATION & RÔLES
- **Dépendances :** Supabase Auth, Next.js 15, Tailwind CSS, TypeScript.
- **Actions Clés :**
  1. Initialiser le projet Next.js avec TypeScript, Tailwind CSS, et composants d'interface shadcn/ui.
  2. Implanter les tokens de design UEC Premium Dark (`#0B1020`, `#111827`, `#172033`, `#2563EB`, `#D62839`, `#22D3EE`).
  3. Mettre en place le moteur d'internationalisation trilingue (FR, AR RTL, EN) avec sélecteur fluide dans le header.
  4. Créer le schéma de base de données PostgreSQL dédié pour Espace Digital avec préfixe `digital_*` :
     - `digital_departments` (pôles spécialisés).
     - `digital_department_members` (membres affectés aux pôles).
     - `digital_roles` & synchronisation avec `profiles`.
  5. Implémenter les politiques RLS strictes garantissant l'étanchéité des rôles (`SUPER_ADMIN`, `COORDINATEUR`, `MEMBER`).
  6. Développer le layout maître adaptatif (`AppSidebar`, `AppHeader`, `Breadcrumbs`, navigation mobile).
- **Critères d'acceptation :**
  - Authentification fonctionnelle avec redirection dynamique selon le rôle.
  - Bascule de langue immédiate avec inversion physique RTL du layout pour l'arabe.
  - Sidebar et navigation contextuelles respectant les permissions.

---

### PHASE 2 — GESTION DES PROJETS & TÂCHES (KANBAN RÉACTIF)
- **Dépendances :** Phase 1 (Départements et Membres validés).
- **Actions Clés :**
  1. Créer les tables `digital_projects`, `digital_project_members`, `digital_tasks`, `digital_task_comments`, `digital_task_attachments`.
  2. Interface de gestion des projets : Vue grille, vue tableau, filtre par pôle, priorité, état et manager.
  3. Tableau de bord des tâches :
     - Vue Kanban dynamique avec colonnes (`BACKLOG`, `TODO`, `IN_PROGRESS`, `SUBMITTED`, `COORDINATOR_REVIEW`, `SUPER_ADMIN_APPROVAL`, `REVISION_REQUIRED`, `APPROVED`, `DONE`).
     - Vue tableau paginée avec filtres avancés.
     - Modalité de création et d'assignation de tâche (réservée au Coordinateur et au Super Admin).
     - Fiche détaillée de la tâche avec critères d'acceptation, pièces jointes et commentaires en temps réel.
- **Critères d'acceptation :**
  - Un membre ne peut modifier l'état que de ses propres tâches assignées.
  - Un Coordinateur ne peut assigner des tâches qu'au sein de son département assigné.
  - Changement de statut synchronisé avec la base de données.

---

### PHASE 3 — COEUR MÉTIER : CENTRE DE SOUMISSION & APPROBATION STRICTE
- **Dépendances :** Phase 2 (Tâches opérationnelles).
- **Règle Fondamentale :** LE SUPER ADMIN EST LE SEUL AUTORISÉ À APPROUVER DÉFINITIVEMENT UN LIVRABLE.
- **Actions Clés :**
  1. Créer la table `digital_submissions` (gestion des versions `v1`, `v2`, etc., fichiers, descriptions, date, statut).
  2. Créer la table `digital_approval_history` (historique immuable de chaque décision, commentaire et horodatage).
  3. Workflow à trois niveaux :
     - **Étape 1 (Membre) :** Soumission du travail terminé avec upload de fichiers et message. La tâche passe en `SUBMITTED`.
     - **Étape 2 (Coordinateur) :** Évaluation par le Coordinateur du pôle. Actions possibles :
       - Demander des corrections internes au membre (statut `REVISION_REQUIRED`).
       - Transmettre au Super Admin pour validation officielle (statut `SUPER_ADMIN_APPROVAL`).
       - *Interdiction absolue d'approuver définitivement.*
     - **Étape 3 (Super Admin) :** Centre d'Approbation dédié. Actions possibles :
       - **APPROUVER :** Verrouillage de la version du livrable, enregistrement du timestamp et de l'ID du Super Admin, notification générale.
       - **REJETER :** Motif obligatoire, enregistrement dans l'historique d'audit, notification au membre et au coordinateur.
       - **DEMANDE DE RÉVISION :** Commentaires précis de correction, génération d'une nouvelle itération de version.
  4. Sécurisation au niveau base de données (Triggers PostgreSQL empêchant toute mise à jour du statut `APPROVED` si l'exécuteur n'est pas vérifié `SUPER_ADMIN`).
- **Critères d'acceptation :**
  - Aucune possibilité technique pour un Coordinateur de passer un livrable à `APPROVED`.
  - Version approuvée rendue immuable (lecture seule).
  - Historique complet d'audit conservé sans écrasement de fichier.

---

### PHASE 4 — MODULES ORGANISATIONNELS
- **Dépendances :** Phases 1, 2, 3.
- **Actions Clés :**
  1. **Centre de Requêtes Internes (`digital_requests`) :**
     - Formulaire de demande de service entre pôles (ex: Design, Vidéo, Support Tech, etc.).
     - Workflow d'acceptation et transformation directe en tâche projet si validée.
  2. **Calendrier Éditorial (`digital_content_calendar`) :**
     - Planning mensuel et hebdomadaire de diffusion réseaux sociaux (Facebook, Instagram, TikTok, LinkedIn, YouTube, Site web).
     - Statut de l'idée à la publication archivée manuellement avec URL.
  3. **Médiathèque Sécurisée (`digital_media_assets`) :**
     - Organisation en dossiers (Logos, Identités, Photos, Vidéos, Fichiers Sources, Templates).
     - Intégration Supabase Storage privé avec génération de liens signés à expiration.
  4. **Gestion du Matériel (`digital_equipment` & `digital_equipment_loans`) :**
     - Inventaire des caméras, optiques, micros, éclairages, PC.
     - Suivi des prêts, contrôle de l'état matériel au départ et au retour, prévention des conflits de réservation.
  5. **Réunions & Communications (`digital_meetings`, `digital_announcements`) :**
     - Planification de réunions avec ordre du jour, lien visio et transformation des décisions en tâches.
     - Diffusion d'annonces ciblées ou globales.
- **Critères d'acceptation :** Tous les modules disposent d'un CRUD complet, validation Zod, et permissions RLS associées.

---

### PHASE 5 — ANALYTIQUE, RAPPORTS & JOURNAL D'AUDIT
- **Dépendances :** Toutes les tables de données opérationnelles.
- **Actions Clés :**
  1. Tableaux de bord différenciés et dynamiques basés sur des requêtes SQL réelles :
     - **Super Admin :** Santé globale du département, productivité par pôle, temps moyen d'approbation, statut des requêtes, alertes retards.
     - **Coordinateur :** Charge de travail des membres de son pôle, avancement des projets, tâches en attente de revue.
     - **Membre :** Tâches assignées, deadlines imminentes, statut de ses soumissions et retours.
  2. Export de données (Rapports CSV/PDF pour assemblées générales et bilans périodiques).
  3. Journal d'Audit (`digital_activity_logs`) enregistrant chaque action sensible (création utilisateur, changement de rôle, soumission, approbation, refus, prêt de matériel).
- **Critères d'acceptation :** Zéro donnée fictive ou statique. Graphiques interactifs réactifs alimentés par la base de données.

---

### PHASE 6 — ASSURANCE QUALITÉ, TESTS & LIVRAISON
- **Actions Clés :**
  1. Tests unitaires et d'intégration (Vitest) sur les règles de gestion et la validation des schémas.
  2. Tests de sécurité RLS simulant chaque rôle (`SUPER_ADMIN`, `COORDINATEUR`, `MEMBER`) pour vérifier l'étanchéité des données.
  3. Tests d'accessibilité (contraste, navigation clavier, sémantique).
  4. Validation de l'ergonomie mobile et tablette.
  5. Documentation complète pour les administrateurs et utilisateurs (`docs/USER_GUIDE.md`, `docs/ROLE_PERMISSIONS.md`, etc.).
- **Critères d'acceptation :** 100% des tests de sécurité RLS validés, build propre sans avertissement TypeScript, application testée de bout en bout.
