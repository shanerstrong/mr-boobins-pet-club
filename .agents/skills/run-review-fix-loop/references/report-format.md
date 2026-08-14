# Review report format

Use `schemas/review-report.schema.json` when a machine-readable report is requested.

Required fields:

- `schemaVersion`: `1`.
- `status`: `pass`, `fail`, or `needs-decision`.
- `reviewPass`: integer from 1 through 3.
- `fixRoundsUsed`: integer from 0 through 2.
- `checks`: name, status, and evidence.
- `findings`: stable id, severity, category, evidence, and recommendation.
- `remainingRisk`: concise residual-risk statement.

Do not mark `pass` while a critical/high finding or required failing check remains.
