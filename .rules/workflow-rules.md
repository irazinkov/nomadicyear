# Nomadic Year Workflow Rules

## Purpose

Operational rules for executing migration tasks with clean branching, small commits, and low merge risk.

## Core Principles

- Keep branches short-lived and task-scoped.
- Merge to `main` frequently.
- Prefer small, reviewable commits over large bundled changes.
- One task branch should map to one clear outcome.

## Branch Strategy

1. Never work directly on `main`.
2. Create a new branch per task, not per full phase.
3. Branch names:
   - `feat/<scope>-<task>`
   - `fix/<scope>-<task>`
   - `chore/<scope>-<task>`
   - `docs/<scope>-<task>`
4. Example branch names:
   - `feat/infra-astro-init`
   - `feat/content-schema-v1`
   - `feat/seo-redirects-import`
   - `docs/phase-0-migration-spec`

## Task Execution Flow

1. Pick one task from the current phase in `migration-plan.md`.
2. Confirm acceptance criteria for that task before coding.
3. Sync latest `main`:
   - `git switch main`
   - `git pull --ff-only`
4. Create task branch:
   - `git switch -c <branch-name>`
5. Implement only the scoped task.
6. Run relevant checks for that task (build/lint/typecheck/tests as applicable).
7. Commit in small logical units.
8. Open PR (or prepare review) and merge quickly once approved.
9. Delete merged branch locally and remotely.

## Commit Rules

1. Use conventional-style prefixes:
   - `feat:`
   - `fix:`
   - `chore:`
   - `docs:`
   - `refactor:`
   - `test:`
2. Commit message format:
   - `<type>: <what changed>`
3. Good examples:
   - `feat: initialize Astro project with Tailwind`
   - `docs: add phase 0 migration spec template`
   - `fix: normalize wordpress date parsing for invalid tz suffix`
4. Keep each commit focused on one intent.
5. Do not mix unrelated files in one commit.

## PR and Merge Rules

1. Rebase or merge from `main` before final review if branch is stale.
2. PR should include:
   - summary of changes
   - acceptance criteria checklist
   - validation evidence (commands run and outcomes)
3. Prefer squash merge for small task branches.
4. After merge:
   - `git switch main`
   - `git pull --ff-only`
   - `git branch -d <branch-name>`

## Phase Guardrails

1. Do not start a new phase until current phase exit criteria are met or explicitly waived.
2. If scope expands, create a new branch rather than extending current branch indefinitely.
3. Track progress in docs:
   - update `migration-plan.md` status notes
   - add decisions to `docs/migration-spec.md`

## Hotfix Rules

1. For production issues, branch from `main`:
   - `fix/hotfix-<short-name>`
2. Keep fix minimal and targeted.
3. Merge and deploy immediately after validation.
4. Backfill docs/tests right after the hotfix merge.

## Quick Command Template

```bash
git switch main
git pull --ff-only
git switch -c feat/<scope>-<task>

# ... make changes ...

git add <files>
git commit -m "feat: <short description>"
git push -u origin feat/<scope>-<task>
```
