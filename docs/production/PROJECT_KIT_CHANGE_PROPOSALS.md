# Codex Project Kit change proposals

This ledger records generic improvements discovered during project work. It is not the installed Project Kit and does not authorize a global skill update.

## Applied to the Project Kit 0.6.0 staging copy

### Storage-provider selection guardrail

For cross-platform, public-facing, collaborative, or automated projects, warn before switching to iCloud. Compare Android/non-Apple access, collaborator and public-review reach, connector/automation support, quota and verification capability, privacy, and second-source-of-truth risk. Do not encode the false universal rule that iCloud is never useful; it can remain an Apple-only personal-backup option. The bootstrapped project should record its own provider decision separately.

### Copy-safe authorization templates

When Codex needs exact approval or authorization wording—or provides commands, IDs, or other text where transcription errors matter—it should put the complete paste-ready text in a fenced `text` block. Ordinary conversational questions should remain prose unless copy/paste materially reduces friction.

## Status

- Project-specific rules are recorded in `AGENTS.md` and `docs/DECISIONS.md`.
- The existing Project Kit 0.6.0 staging copy contains both generic guardrails. `skill-creator` `quick_validate.py` passed, and a fresh New-mode software/visual-design bootstrap preview returned no conflicts and made no target writes.
- Installing over the global `bootstrap-codex-project` skill is not authorized.
