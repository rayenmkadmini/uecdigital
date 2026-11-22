# UEC ESPACE DIGITAL — PHASE 2.4.4.2
## Role & Identity Runtime Validation Matrix (PostgreSQL 17.6)

**Project:** UEC — Espace Digital (*Union des Étudiants Clubistes — Depuis 2021*)  
**Repository:** `rayenmkadmini/uec`  
**Branch:** `feature/uec-espace-digital`  
**Runtime Engine:** Native PostgreSQL 17.6 on Linux x86_64  
**Test Harness:** `scripts/test-phase2442-postgres17.mjs`

---

### 1. Measured Test Results & SQLSTATE Mapping

Every test case executed in PostgreSQL 17 was instrumented to verify the transaction outcome, returned SQLSTATE code, and error text:

```
+-----------------------------------------------------------------------------------------------------------------------------+
| Test ID | Role Context        | Target Operation             | Expected Outcome | Actual SQLSTATE | Runtime Status          |
|:--------|:--------------------|:-----------------------------|:-----------------|:----------------|:------------------------|
| ID-01   | postgres (DBA)      | UPDATE task title            | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| ID-02   | service_role        | UPDATE task title            | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| ID-03   | anon (No JWT)       | UPDATE task title            | DENY             | P0001 (UNAUTH)  | EXECUTED AND PASSED     |
| MEM-01  | Member 1 (Assigned) | UPDATE status TODO->IN_PROG  | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| MEM-02  | Member 1 (Assigned) | UPDATE title                 | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-03  | Member 1 (Assigned) | UPDATE description           | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-04  | Member 1 (Assigned) | UPDATE acceptance_criteria   | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-05  | Member 1 (Assigned) | UPDATE priority              | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-06  | Member 1 (Assigned) | UPDATE deadline              | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-07  | Member 1 (Assigned) | UPDATE start_date            | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-08  | Member 1 (Assigned) | UPDATE department_id         | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-09  | Member 1 (Assigned) | UPDATE created_by            | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-10  | Member 1 (Assigned) | UPDATE coordinator_id        | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-11  | Member 1 (Assigned) | UPDATE id (Primary Key)      | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-12  | Member 1 (Assigned) | UPDATE created_at            | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-13  | Member 1 (Assigned) | UPDATE status -> DONE        | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-14  | Member 1 (Assigned) | UPDATE status -> APPROVED    | DENY             | P0001 (APPR_VI) | EXECUTED AND PASSED     |
| MEM-15  | Member 1 (Assigned) | UPDATE status -> COORD_REV   | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| MEM-16  | Member 2 (Unassigned)| UPDATE status TODO->IN_PROG | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| COORD-01| Coordinator (Dept A)| UPDATE title in own dept     | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| COORD-02| Coordinator (Dept A)| UPDATE priority in own dept  | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| COORD-03| Coordinator (Dept A)| UPDATE department_id (xfer)  | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| COORD-04| Coordinator (Dept A)| UPDATE created_by            | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| COORD-05| Coordinator (Dept A)| UPDATE status -> APPROVED    | DENY             | P0001 (APPR_VI) | EXECUTED AND PASSED     |
| COORD-06| Coordinator (Dept A)| UPDATE status -> DONE        | DENY             | P0001 (APPR_VI) | EXECUTED AND PASSED     |
| COORD-07| Coordinator (Dept A)| UPDATE title in Dept B task  | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| SA-01   | Super Admin          | UPDATE title & department    | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| SA-02   | Super Admin          | UPDATE status -> APPROVED    | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| SA-03   | Super Admin          | UPDATE status -> DONE        | ALLOW            | 00000 (SUCCESS) | EXECUTED AND PASSED     |
| SA-04   | Super Admin          | UPDATE id (Primary Key)      | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
| SA-05   | Super Admin          | UPDATE created_at            | DENY             | P0001 (FORBID)  | EXECUTED AND PASSED     |
+-----------------------------------------------------------------------------------------------------------------------------+
```

---

### 2. Verified Error Messages in PostgreSQL 17

1. **Anonymous Mutation:**  
   `ERROR: UNAUTHORIZED: Session utilisateur valide requise pour modifier une tâche.` (SQLSTATE `P0001`)
2. **Member Structural Mutation:**  
   `ERROR: FORBIDDEN: Seuls le coordinateur de pôle ou le Super Admin peuvent modifier la définition ou les métadonnées de la tâche.` (SQLSTATE `P0001`)
3. **Universal Immutability (`id`, `created_at`):**  
   `ERROR: FORBIDDEN: Les champs identifiant (id) et date de création (created_at) sont strictement immuables.` (SQLSTATE `P0001`)
4. **Approval Enforcement:**  
   `ERROR: APPROVAL_VIOLATION: Seul le Super Admin peut valider une tâche au statut APPROVED.` (SQLSTATE `P0001`)
5. **Coordinator Approval Bypass Guard:**  
   `ERROR: APPROVAL_VIOLATION: Seul le Super Admin est habilité à approuver ou clôturer définitivement une tâche (statut demandé: DONE).` (SQLSTATE `P0001`)
6. **Unassigned Member Isolation:**  
   `ERROR: FORBIDDEN: Vous n'êtes pas assigné à cette tâche.` (SQLSTATE `P0001`)

---

### 3. Conclusion

All 31 role and identity scenarios passed with exact expected SQLSTATE codes and error strings on PostgreSQL 17.6.
