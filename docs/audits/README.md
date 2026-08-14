# Audit reports

Store dated reports for explicitly approved bounded audits. Each report records frozen scope and baseline, acceptance criteria, checked commands and artifacts, findings by severity, fixes, review-pass and fix-round counts, remaining risk, and final status `pass`, `fail`, or `needs-decision`.

This folder does not authorize an audit. Do not offer one before the first reviewable milestone unless the user explicitly requests it. Create an audit task only after the user approves a bounded scope; after the first audit—or a declined first offer—offer another only following a material change with meaningful regression or safety risk. A decline creates no task or report; record only its date and outcome in `PLANS.md`.
