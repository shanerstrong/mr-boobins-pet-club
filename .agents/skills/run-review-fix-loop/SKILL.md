---
name: run-review-fix-loop
description: Run a bounded implementation review and fix workflow using deterministic checks, independent read-only review, one writer, structured findings, and explicit stop conditions. Use after code, UI, document, media, configuration, or automation changes when Codex should verify and correct its work without open-ended iteration.
---

# Run Review Fix Loop

Verify and improve an implementation without allowing self-review to become an unbounded loop.

## Establish the contract

Before changing anything, freeze:

- Objective and allowed scope.
- Acceptance criteria and definition of done.
- Baseline behavior or artifact.
- Exact deterministic checks.
- Applicable profile references.
- Human-gated actions.

Read only the relevant profile: [software.md](references/software.md), [visual-design.md](references/visual-design.md), or [docs-media.md](references/docs-media.md). Read [report-format.md](references/report-format.md) when producing a machine-readable report.

## Run the loop

1. Use exactly one writer in the checkout.
2. Make one focused implementation batch.
3. Run deterministic checks and capture evidence.
4. Use independent read-only review for correctness, security, regressions, missing verification, and profile-specific quality.
5. Deduplicate findings and reject unsupported or style-only comments.
6. Let the same writer fix accepted findings.
7. Re-run the failed checks and one focused review pass.
8. Finish when checks pass, no critical/high finding remains, and required artifacts are verified.

## Limits

- Allow at most three review passes total.
- Allow at most two fix rounds.
- Stop if the same failure appears twice without a new diagnosis.
- Stop if a fix round produces no measurable improvement.
- Stop for missing product decisions, scope expansion, secrets, destructive actions, external writes, or untrusted executable content.
- Never auto-commit, merge, push, open a PR, publish, deploy, or contact third parties.

## Report

Return checks with evidence, deduplicated findings by severity, fixes applied, pass and fix counts, remaining risk, and one of `pass`, `fail`, or `needs-decision`.
