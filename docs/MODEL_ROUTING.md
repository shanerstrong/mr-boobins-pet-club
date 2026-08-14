# Model routing

Configuration: `.codex-kit/model-routing.json`.

- User-selected model or effort always wins.
- Automatic mode resolves a logical profile against destination-host capabilities immediately before task creation.
- Disabled mode inherits user defaults and omits model overrides.
- Unavailable models or efforts are reported with a proposed fallback; they are never silently replaced.
- Pass successful selections through actual task-creation `model` and `thinking` fields and record the reason in the charter.
- Keep settings stable within a coherent phase. Escalate only at task creation, explicit user request, or a recorded phase boundary.
- `max` requires a task-specific justification.
- `high-risk` and `final-audit` cannot automatically fall below the configured flagship floor.

API-only controls such as Pro mode, persisted reasoning context, and text verbosity are advisory unless the active Codex interface explicitly exposes them.
