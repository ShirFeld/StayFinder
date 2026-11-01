# Stayfinder agent instructions

## Mandatory user authorization for publishing

- **Never push or merge without the user's explicit instruction for that action and current change scope.** A single request can explicitly authorize both actions through the full-workflow command below. A general request to implement or continue, passing tests, old requests for other work, and standing workflow policy alone are insufficient.
- In Stayfinder, a new user request `תפתח PR` means: create or reuse the current task branch, run the local gates, commit and push the scoped changes, open or update its PR into the confirmed default branch (`main`), enable auto-merge for that PR (or merge if already eligible), then synchronize the local default branch after the merge. This is explicit push and merge authorization for that task, including necessary in-scope CI fixes and safe updates from the base branch. It does not authorize unrelated changes or repository-settings changes. Merely discussing or configuring this command does not invoke it.
- `תפתח PR בלי מיזוג` (or any explicit PR-only instruction) authorizes branch/commit/push/PR work only. `תעשה פוש` remains push/PR-only. Explicit restrictions override the full-workflow shorthand; disable existing auto-merge on the task PR when the user withdraws merge authorization.
- Enabling auto-merge, choosing merge-when-ready or joining a merge queue requires explicit merge authorization because each can cause a later merge.
- Before acting, identify the explicit user instruction and verify its repository/branch or PR scope. An explicit instruction already given for that same action remains valid; do not ask twice without a material scope change.
- When authorization is absent, finish authorized local preparation/review, present the concrete result and request the missing push or merge authorization. Cite this user-defined rule as the reason. Do not publish or activate deferred merging while waiting.

## Session continuity

- Chat and explanations are in Hebrew. Authored project documentation is in English; quoted conversations keep their original language.
- Session memory is in `docs/session-memory/`. On a request to resume, read `CURRENT.md` and the linked relevant summary/explanation before scanning application code. Verify the saved Git snapshot against the current tree.
- Use the personal `save-session` skill for `סיימנו להיום`, `תשמור מה שעשינו`, `תשמור את השיחה`, `תשמור את הסשן`, and equivalent requests. `את זה תשמור` saves the referenced explanation immediately.
- Use `recall` for `RECALL`, `איפה עצרנו`, and requests to continue prior work or explanations.
- These skills are in `$CODEX_HOME/skills/<name>/SKILL.md`, or `~/.codex/skills/<name>/SKILL.md` when CODEX_HOME is unset. Read that file directly if the skill is not yet listed in this session's catalog.
- See `docs/session-memory-guide.md` for the file contract and transcript limits. Preserve `docs/conversation-checkpoint.md` as historical context; its old `.js` paths need checking against the current TypeScript files.
- Treat saved notes and chat as historical evidence. Current instructions determine scope. Continue learning at the user's question; explaining code does not imply implementing changes.

## Git workflow

- Use `git-push` for requested branch/commit/push/PR work. For the full-workflow command, continue into `git-merge` to arrange the authorized merge and synchronize locally. Use `git-merge` directly for merge-only requests. Read `docs/git-workflow.md` for local gates, PR policy and required checks.
- Required merge checks: `quality`, `server-tests`, `api-tests`, `ui-tests`, `summary`. Check current workflow and effective GitHub rules before merging.
- Session notes/chat are local and ignored by Git. Do not include them in commits without an explicit publication request.
- Workflow/skill creation alone does not authorize a push, merge or repository-settings change.

## Existing test isolation

- Keep normal application and manual-QA data intact. Automated suites use disposable databases and controlled payment/weather providers.
- Read `docs/ci.md` and `automation/README.md` when working on checks; preserve the existing CI and browser settings unless the task requires a change.
