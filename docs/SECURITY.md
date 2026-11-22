# ARCHITECTURE DE SÉCURITÉ & POLITIQUES RLS — UEC ESPACE DIGITAL
**Directives de Sécurité Applicative et Base de Données**  
**Organisation :** Union des Étudiants Clubistes (UEC)  
**Projet Supabase :** `aigsdarfiplwmzqtqlxh`

---

## 1. Principes de Sécurité Fondamentaux

1. **Défense en Profondeur :**  
   Aucune décision d'autorisation ne repose exclusivement sur le frontend. La base de données PostgreSQL applique systématiquement le filtrage par **Row-Level Security (RLS)** sur l'intégralité des tables exposées dans l'API `public`.
2. **Moindre Privilège :**  
   Les comptes ne disposent que des droits strictement nécessaires à l'exercice de leurs fonctions dans leur pôle d'affectation.
3. **Imperméabilité des Identifiants Secrets :**  
   La clé `service_role` ne figure dans aucun composant ni route exposée côté client. Seules les variables publiques (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) sont accessibles au navigateur.
4. **Intégrité de l'Approbation :**  
   Des fonctions stockées et des déclencheurs serveur (triggers) garantissent l'impossibilité matérielle pour un rôle autre que `SUPER_ADMIN` de valider un livrable.

---

## 2. Fonctions d'Autorisation PostgreSQL (`private.*`)

Pour éviter la récursivité des politiques RLS et garantir une exécution performante et infalsifiable, les fonctions suivantes sont définies dans le schéma interne `private` :

```sql
-- 1. Vérification du rôle Super Admin
CREATE OR REPLACE FUNCTION private.is_super_admin(p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_uid AND role = 'SUPER_ADMIN' AND is_active = true
  );
$$;

-- 2. Vérification du rôle Coordinateur sur un département
CREATE OR REPLACE FUNCTION private.is_coordinator_of(p_dept_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.departments
    WHERE id = p_dept_id AND coordinator_id = p_uid AND is_active = true
  ) OR private.is_super_admin(p_uid);
$$;

-- 3. Vérification de l'appartenance d'un membre à un département
CREATE OR REPLACE FUNCTION private.is_member_of_department(p_dept_id uuid, p_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.department_members
    WHERE department_id = p_dept_id AND user_id = p_uid
  ) OR private.is_super_admin(p_uid);
$$;
```

---

## 3. Déclencheurs de Sécurité Incontournables

### 3.1 Protection contre l'Escalade de Privilèges sur les Rôles
Un utilisateur authentifié ne peut sous aucun prétexte modifier son propre rôle ou son statut actif dans `public.profiles`.
```sql
CREATE OR REPLACE FUNCTION private.prevent_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    IF NOT private.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'PERMISSION DENIED: Seul le Super Admin peut modifier les rôles ou statuts de compte.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
```

### 3.2 Verrouillage Strict de l'Approbation Finale
Un livrable ou une tâche ne peut passer au statut `APPROVED` que si l'auteur de la transaction est vérifié `SUPER_ADMIN`.
```sql
CREATE OR REPLACE FUNCTION private.enforce_super_admin_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
    IF NOT private.is_super_admin(auth.uid()) THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Seul le Super Admin dispose de l''autorité d''approbation finale.';
    END IF;
    NEW.is_locked := true;
    NEW.approved_by_super_admin_at := now();
    NEW.super_admin_id := auth.uid();
  END IF;

  -- Interdiction de modifier une soumission déjà verrouillée
  IF OLD.is_locked = true AND (OLD.description <> NEW.description OR OLD.file_urls <> NEW.file_urls) THEN
    RAISE EXCEPTION 'IMMUTABILITY VIOLATION: Une soumission approuvée ne peut plus être altérée. Créez une nouvelle version.';
  END IF;

  RETURN NEW;
END;
$$;
```

---

## 4. Politique de Sécurité du Stockage (Supabase Storage)

- **Bucket Privé :** `espace-digital-media` (`public = false`).
- **Permissions de Téléversement :**
  - Réservé aux utilisateurs authentifiés et actifs.
  - Taille maximale autorisée par fichier : 50 Mo.
  - Types MIME validés (images, vidéos, PDF, archives ZIP, sources Figma/Illustrator).
- **Accès en Téléchargement :**
  - Génération obligatoire d'URLs signées temporaires (`createSignedUrl`) avec expiration paramétrée (ex: 3600 secondes).
  - Contrôle RLS vérifiant l'affectation de l'utilisateur au pôle ou au projet rattaché au fichier.

---

## 5. Journalisation d'Audit Inaltérable (`activity_logs`)

- **Permissions API Directes :**
  - `SELECT` : Accordé uniquement à `SUPER_ADMIN` (et aux utilisateurs pour leurs propres actions).
  - `INSERT` : Strictement restreint aux triggers de base de données ou fonctions RPC dédiées.
  - `UPDATE` : **TOTALEMENT INTERDIT** (`DENY ALL`).
  - `DELETE` : **TOTALEMENT INTERDIT** (`DENY ALL`).
- Aucune manipulation ou falsification rétrospective des événements d'audit n'est physiquement réalisable via l'API Supabase.
