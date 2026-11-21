# MATRICE DES RÔLES & PERMISSIONS — UEC ESPACE DIGITAL
**Autorité et Modèle d'Habilitation RLS**  
**Organisation :** Union des Étudiants Clubistes (UEC)  
**Principe Fondateur :** Le contrôle d'accès est garanti par le serveur et la base de données PostgreSQL (Row-Level Security), jamais uniquement par l'interface utilisateur.

---

## 1. Définition des Rôles Primaires

### 1.1 `SUPER_ADMIN`
Le Super Admin est la plus haute autorité exécutive du Département Digital.
- **Portée :** Globale sur tous les départements, membres, projets, tâches, matériels et configurations.
- **Privilège Exclusif Inaliénable :** **SEUL LE SUPER ADMIN PEUT APPROUVER DÉFINITIVEMENT UN LIVRABLE.** Aucun autre rôle ne dispose des droits de validation finale.
- **Capacités :** Création et désactivation des pôles, attribution des coordinateurs, nomination et révocation des membres, accès total aux audits et analyses.

### 1.2 `COORDINATOR`
Le Coordinateur gère un pôle de compétences spécialisé (ex: Design, Vidéo, Web, etc.).
- **Portée :** Circonscrite à son pôle de rattachement.
- **Capacités :** Planification des projets du pôle, création et assignation des tâches, contrôle intermédiaire des soumissions de ses membres, demande de corrections internes, transmission des travaux au Super Admin.
- **Interdictions Absolues :** 
  - Ne peut PAS approuver définitivement un travail officiel.
  - Ne peut PAS modifier les privilèges ou rôles d'un autre utilisateur.
  - Ne peut PAS accéder aux données privées d'autres départements non autorisés.

### 1.3 `MEMBER`
Le Membre opérationnel réalise les tâches au sein de son ou ses équipes.
- **Portée :** Espace personnel et projets auxquels il est formellement affecté.
- **Capacités :** Mise à jour du statut de progression de ses tâches, dépôt de livrables et fichiers sources, émission de requêtes internes, consultation des annonces et réunions.
- **Interdictions Absolues :**
  - Ne peut PAS modifier le statut d'approbation d'un livrable.
  - Ne peut PAS assigner de tâches à autrui.
  - Ne peut PAS modifier son propre rôle ou celui des tiers.

---

## 2. Matrice d'Habilitation par Module

| Module / Ressource | Action / Opération | `SUPER_ADMIN` | `COORDINATOR` | `MEMBER` |
| :--- | :--- | :---: | :---: | :---: |
| **Comptes & Profils** | Consulter l'annuaire | ✅ Tout | ✅ Tout | ✅ Membres de son pôle |
| | Modifier son propre profil | ✅ | ✅ | ✅ |
| | Modifier le rôle d'un utilisateur | ✅ Exclusif | ❌ | ❌ |
| | Suspendre un compte | ✅ Exclusif | ❌ | ❌ |
| **Départements** | Créer / Activer / Désactiver un pôle | ✅ Exclusif | ❌ | ❌ |
| | Affecter des membres | ✅ | ✅ Dans son pôle | ❌ |
| | Nommer un coordinateur | ✅ Exclusif | ❌ | ❌ |
| **Projets** | Créer un projet | ✅ Tout | ✅ Dans son pôle | ❌ |
| | Modifier / Archiver un projet | ✅ Tout | ✅ Dans son pôle | ❌ |
| | Consulter les projets | ✅ Tous | ✅ Son pôle | ✅ Projets assignés |
| **Tâches** | Créer & Assigner une tâche | ✅ Tout | ✅ Dans son pôle | ❌ |
| | Mettre à jour la progression | ✅ Tout | ✅ Dans son pôle | ✅ Ses tâches assignées |
| | Supprimer une tâche | ✅ Tout | ✅ Dans son pôle | ❌ |
| **Livrables & Approbation** | Déposer une soumission (livrable) | ✅ | ✅ | ✅ Ses tâches assignées |
| | Revue intermédiaire & retours internes | ✅ | ✅ Dans son pôle | ❌ |
| | Transmettre au Super Admin | ✅ | ✅ Dans son pôle | ❌ |
| | **Approbation Finale Officielle** | ✅ **SEUL AUTORISÉ** | ❌ **INTERDIT** | ❌ **INTERDIT** |
| | **Rejet Définitif** | ✅ **SEUL AUTORISÉ** | ❌ | ❌ |
| **Requêtes Internes** | Émettre une requête de service | ✅ | ✅ | ✅ |
| | Prendre en charge une requête | ✅ Tout | ✅ Vers son pôle | ❌ |
| | Clôturer une requête | ✅ Tout | ✅ Dans son pôle | ❌ |
| **Calendrier Éditorial** | Proposer une idée de publication | ✅ | ✅ | ✅ |
| | Planifier une publication | ✅ | ✅ Pôle Social/Com | ❌ |
| | Valider la publication officielle | ✅ Exclusif | ❌ | ❌ |
| | Enregistrer l'URL de publication réelle | ✅ | ✅ Pôle Social/Com | ❌ |
| **Médiathèque** | Uploader des assets de marque / logos | ✅ | ✅ | ✅ Sur projets autorisés |
| | Télécharger des fichiers sources privés | ✅ | ✅ | ✅ Projets autorisés |
| | Supprimer des assets | ✅ | ✅ Ses uploads | ❌ |
| **Matériel & Prêts** | Gérer le parc matériel (ajout, état) | ✅ Exclusif | ❌ | ❌ |
| | Demander un emprunt de matériel | ✅ | ✅ | ✅ |
| | Valider un emprunt | ✅ Exclusif | ❌ | ❌ |
| | Enregistrer le retour et l'état | ✅ Exclusif | ❌ | ❌ |
| **Réunions** | Créer une réunion | ✅ Tout | ✅ Son pôle | ❌ |
| | Rédiger le procès-verbal & actions | ✅ | ✅ Son pôle | ❌ |
| | Consulter ses convocations | ✅ | ✅ | ✅ Réunions assignées |
| **Annonces** | Publier une annonce globale | ✅ Exclusif | ❌ | ❌ |
| | Publier une annonce de pôle | ✅ | ✅ Son pôle | ❌ |
| **Audit & Rapports** | Consulter les logs d'activité système | ✅ Exclusif | ❌ | ❌ |
| | Exporter les bilans analytiques | ✅ Global | ✅ Son pôle | ❌ |
