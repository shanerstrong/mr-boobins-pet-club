# Software review profile

Prioritize:

1. Correctness and observable behavior.
2. Security, permissions, secrets, and data loss.
3. Regressions and compatibility.
4. Missing or weak tests.
5. Type, lint, build, migration, accessibility, and smoke-test failures.
6. Maintainability only when it creates a concrete future defect risk.

Use the repository's canonical commands. Do not invent passing evidence or weaken checks to make the loop succeed.
