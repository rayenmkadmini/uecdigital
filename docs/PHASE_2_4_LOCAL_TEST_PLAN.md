# UEC ESPACE DIGITAL — PHASE 2.4 LOCAL SECURITY TEST PLAN
## Isolated Test Suite & Verification Matrix for Task Security Remediation

**Project:** UEC — Espace Digital  
**Target Module:** Task Management Security (`public.tasks`, `trg_enforce_task_member_immutability`)  
**Date:** 2026-11-21  

---

## 1. Local Testing Environment Setup

To validate SEC-V01 remediation without touching the production database `aigsdarfiplwmzqtqlxh`, tests are designed to execute in an **isolated local environment** (such as a local Supabase CLI instance or a standalone PostgreSQL test container).

### Test Fixtures (Isolated Test Data):
```
Departments:
- Dept 1: DESIGN (ID: '10000000-0000-0000-0000-000000000001')
- Dept 2: VIDEO  (ID: '10000000-0000-0000-0000-000000000002')

Users (in auth.users & public.profiles):
- User 1: Admin   (ID: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', role: 'SUPER_ADMIN')
- User 2: Coord-D (ID: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'COORDINATOR', dept: Dept 1)
- User 3: Member-D(ID: 'cccccccc-cccc-cccc-cccc-cccccccccccc', role: 'MEMBER', dept: Dept 1)
- User 4: Member-V(ID: 'dddddddd-dddd-dddd-dddd-dddddddddddd', role: 'MEMBER', dept: Dept 2)

Tasks:
- Task 1: Dept 1, assigned to User 3 (status: 'TODO')
- Task 2: Dept 1, assigned to User 3 (status: 'COORDINATOR_REVIEW')
- Task 3: Dept 1, assigned to User 3 (status: 'APPROVED')
- Task 4: Dept 2, assigned to User 4 (status: 'TODO')
```

---

## 2. Test Scenarios for MEMBER Role

| Test ID | Scenario Description | Action / Payload | Expected Outcome | Classification |
|---|---|---|---|---|
| **M-01** | Member updates allowed status | Set `status = 'IN_PROGRESS'` on Task 1 | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **M-02** | Member regresses from in progress | Set `status = 'TODO'` on Task 1 | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **M-03** | Member attempts title update | Set `title = 'Modified Title'` on Task 1 | **SUCCESS** (if permitted by business rules) or **FORBIDDEN** | `INTEGRATION_TEST` |
| **M-04** | Member attempts description update | Set `description = 'New content'` on Task 1 | **SUCCESS** (collaboration field) | `INTEGRATION_TEST` |
| **M-05** | Member attempts deadline modification | Set `deadline = now() + 30 days` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-06** | Member attempts priority escalation | Set `priority = 'CRITICAL'` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-07** | Member attempts department transfer | Set `department_id = Dept 2` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-08** | Member attempts project re-association | Set `project_id = <other_proj>` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-09** | Member attempts coordinator re-assignment | Set `coordinator_id = <other_user>` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-10** | Member attempts author forgery | Set `created_by = <other_user>` | **EXCEPTION: FORBIDDEN** (Administrative metadata) | `INTEGRATION_TEST` |
| **M-11** | Member updates unassigned task | Update Task 4 in Dept 2 | **REJECTED BY RLS** (0 rows updated) | `INTEGRATION_TEST` |
| **M-12** | Member modifies submitted task | Update Task 2 (`COORDINATOR_REVIEW`) | **EXCEPTION: FORBIDDEN** (Task in review) | `INTEGRATION_TEST` |
| **M-13** | Member modifies approved task | Update Task 3 (`APPROVED`) | **EXCEPTION: FORBIDDEN** (Task finalized) | `INTEGRATION_TEST` |
| **M-14** | Member bypasses approval to `DONE` | Set `status = 'DONE'` on Task 1 | **EXCEPTION: FORBIDDEN** (Status restricted to TODO/IN_PROGRESS) | `INTEGRATION_TEST` |
| **M-15** | Member attempts direct `APPROVED` | Set `status = 'APPROVED'` on Task 1 | **EXCEPTION: APPROVAL_VIOLATION** | `INTEGRATION_TEST` |

---

## 3. Test Scenarios for COORDINATOR Role

| Test ID | Scenario Description | Action / Payload | Expected Outcome | Classification |
|---|---|---|---|---|
| **C-01** | Coordinator updates own dept task | Update `title`, `deadline`, `priority` on Task 1 | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **C-02** | Coordinator updates other dept task | Update Task 4 in Dept 2 | **REJECTED BY RLS** (0 rows updated) | `INTEGRATION_TEST` |
| **C-03** | Coordinator modifies submitted task | Review Task 2 to `SUPER_ADMIN_APPROVAL` | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **C-04** | Coordinator attempts direct final approval | Set `status = 'APPROVED'` on Task 1 | **EXCEPTION: APPROVAL_VIOLATION** (Super Admin only) | `INTEGRATION_TEST` |
| **C-05** | Coordinator modifies approved task | Attempt modifying `priority` on Task 3 (`APPROVED`) | **EXCEPTION: FORBIDDEN** (Approved tasks locked for coordinator) | `INTEGRATION_TEST` |
| **C-06** | Coordinator attempts direct REST injection | Send direct `PATCH` on unauthorized task | **REJECTED BY RLS** | `INTEGRATION_TEST` |

---

## 4. Test Scenarios for SUPER_ADMIN Role

| Test ID | Scenario Description | Action / Payload | Expected Outcome | Classification |
|---|---|---|---|---|
| **A-01** | Super Admin performs legitimate task administration | Update task across any department | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **A-02** | Super Admin updates protected metadata | Modify `department_id`, `priority`, `deadline` | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **A-03** | Super Admin completes final approval | Set `status = 'APPROVED'` | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |
| **A-04** | Super Admin unlocks/modifies closed task | Correct metadata on approved task | **SUCCESS (HTTP 200)** | `INTEGRATION_TEST` |

---

## 5. Execution Safeguards

- These tests MUST NOT be executed against production `aigsdarfiplwmzqtqlxh`.
- All tests will be run strictly in a local isolated test environment prior to presenting the remediation for final production deployment.
