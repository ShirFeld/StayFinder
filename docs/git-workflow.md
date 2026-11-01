# Agent Git workflow

The personal `git-push` skill prepares and publishes task changes. The `git-merge` skill completes an authorized PR merge and, for the full workflow, synchronizes the local checkout. Creating or updating these skills does not execute either publishing workflow.

## Mandatory explicit user instruction

**Never perform a push or merge without the user's explicit request or approval for that action and the current changes.** One request can authorize both actions through the full-workflow command below. General implementation requests, continuation requests, successful tests, earlier requests for different work, automatic skill selection and standing workflow policy alone do not grant it.

Examples of explicit instructions: `תעשה פוש` for pushing and `תמזג כשהבדיקות עוברות` for merging the identified PR once eligible. Enabling auto-merge or adding a PR to a merge queue also requires explicit merge authorization. A merge-only request does not authorize pushing additional fixes.

Immediately before acting, identify the explicit instruction and confirm it still covers the current repository/branch or PR and change scope. An instruction already given for that same action remains valid; no repeated approval is needed solely because checks finished later. If authorization is absent, complete authorized preparation/review, present the changes and check results, then request the specific missing authorization, explaining that this user-defined rule requires it. Do not publish or activate a future merge while waiting.

## One-request PR workflow

In Stayfinder, a new user request `תפתח PR` explicitly authorizes the complete workflow for the current task:

1. Review the scoped changes, create a task branch (or reuse its existing branch), and run the required local gates.
2. Commit and push those changes, then open or update one PR into the confirmed default branch, currently `main`.
3. Invoke `git-merge` to enable native auto-merge for that PR using squash and a current-head guard. If it is already eligible, merge immediately through the same rules.
4. While the session is active, investigate failures, make necessary fixes within the same task, rerun affected local gates, and push the fixes. Safe integration of a newer base branch is included; repeat verification on the updated head. Stop for unrelated changes, substantive conflicts, unavailable prerequisites or repeated unchanged failures.
5. Observe the actual merge, then synchronize the local default branch and refresh the application as described below.

This command supplies both push and merge authorization; do not ask for those permissions again within the same task scope. It does not authorize repository-settings changes, unrelated work, publication of private session records, or branch deletion. Discussing, quoting or configuring the command does not invoke it.

`תפתח PR בלי מיזוג` and other explicit PR-only requests authorize steps 1–2 only. `תעשה פוש` also remains push/PR-only. Explicit restrictions always take precedence. If the user withdraws merge authorization after auto-merge was enabled for the task PR, disable it and re-read the PR state; report if the merge already happened.

## Branch, commit and PR

Use a task branch rather than committing task work on `main`. Reuse a branch that already belongs to the task; otherwise create a short descriptive name with `feat/`, `fix/`, `docs/`, `test/`, or `chore/` as appropriate. Follow the repository's existing commit style with a concrete subject, for example `docs: add session continuity workflow`.

Review changed and staged content, keep unrelated user work intact, and stage explicit paths. Exclude credentials, local databases, generated reports/build output and ignored session conversations. Inspect both the staged diff and `git diff --cached --check` before committing. Push normally to the confirmed remote, setting the upstream when needed.

After a requested push, create or update one PR targeting the intended base branch, normally `main`. Include resulting behavior, relevant rationale, validation and known limits. Reuse an existing task PR. A push-only request does not request a merge; the full-workflow command above explicitly requests both.

## Before pushing

Always run `git diff --check` and inspect the selected patch. Use the current package scripts and `.nvmrc`; the observed baseline is Node `22.23.3`.

| Change                                                           | Local gate                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentation, agent instructions or skill metadata only         | Run the installed Prettier on the selected maintained Markdown/YAML files and `git diff --check`. Validate changed skills with the bundled skill validator. Application tests are unnecessary when application/build/test behavior is unchanged. |
| Application, test, configuration, dependencies or build behavior | Run `npm run check` and `npm run test:ci`. Run `npm run test:api` for server/API/database/fixture changes, and `npm run test:ui` for UI, browser, shared fixture or user-flow changes. Run both when both layers are affected.                   |
| CI workflow, verification aggregation or test infrastructure     | Run `npm run check`, `npm run test:ci`, `npm run test:api`, and `npm run test:ui`, plus focused checks for the changed workflow/script.                                                                                                          |

`npm run check` already includes formatting, lint, TypeScript checks and the client build; avoid needlessly running that same build again. Missing prerequisites and failed mandatory local gates are blockers to publication under this workflow; report them rather than silently counting them as passed.

API/UI suites use disposable databases. For an API-only run, the CI workflow uses `STAYFINDER_SKIP_CLIENT_BUILD=1`. For headless local verification, temporarily set `CI=true` for that invocation and restore its previous value afterward; do not change the project's normal headed-browser configuration. See `docs/ci.md` and `automation/README.md` for prerequisites and report locations.

## Merge gates

The following named GitHub checks must all be present and successful for the current PR state:

| Check          | Existing workflow command                                       |
| -------------- | --------------------------------------------------------------- |
| `quality`      | `npm run check`                                                 |
| `server-tests` | `npm run test:ci`                                               |
| `api-tests`    | `npm run test:api`                                              |
| `ui-tests`     | `npm run test:ui`                                               |
| `summary`      | `.github/scripts/verification-summary.ts` after the four groups |

Consult current workflow files and live rules before acting. Green results from an older PR head are insufficient. Missing, skipped, neutral, cancelled, timed-out or failed required checks are unresolved. Respect the effective up-to-date-base and review rules; use a head-commit guard during the merge to detect concurrent changes. Default to squash when no method is specified and it is allowed.

GitHub Actions runs the checks, effective branch rules enforce them, and native auto-merge can merge after the requirements are met. If auto-merge is unavailable or disabled, the skill may wait during the active session and merge once eligible; otherwise it leaves a pending PR and reports the outstanding requirements. It does not silently enable repository settings or bypass rules.

## Repository permission and per-PR auto-merge

There are two separate controls:

- Repository-level **Settings → General → Pull Requests → Allow auto-merge** makes native auto-merge available. Enabling it requires an explicit configuration request; it does not enable auto-merge on every PR.
- Per-PR auto-merge schedules only that PR. The full-workflow command enables it for the current task PR; PR-only requests leave it off. Required checks and all other branch rules still apply.

Before scheduling, confirm that effective GitHub rules enforce all five checks above. A missing required rule blocks unattended merging until it is restored through separately authorized configuration work. Auto-merge waits for eligibility; it does not fix failures, resolve conflicts or update a stale branch itself. During an active session, the agent handles safe in-scope fixes and base updates. If it cannot continue, report the blocker and whether auto-merge remains enabled.

Native auto-merge can complete after the chat closes. Local synchronization and application refresh require an active agent with access to this computer; no background local updater is installed by this workflow. On returning to an unfinished handoff, inspect the actual PR state before continuing.

## Local synchronization after merge

For the full workflow, verify the PR is actually merged before switching branches:

1. Fetch the confirmed remote and inspect the working tree and local default branch. Preserve unrelated edits, staged changes and untracked files. If the tree is dirty or the default branch has diverged, stop local synchronization and report the exact blocker; do not reset, auto-stash, discard work or rewrite history.
2. Switch to the confirmed default branch and run `git pull --ff-only` against its confirmed remote/base. Verify that local HEAD matches the fetched remote tip and contains the PR's merged commit. A squash merge creates a new commit, so the former task head is not the ancestry check.
3. If the lockfile changed, refresh dependencies using the project's documented install command. Build or restart only the relevant application processes when needed and verify they are ready. Do not reset the normal or manual-QA database; report any required data operation that cannot be performed safely.
4. Report merge state and local application state separately: merged on GitHub, synchronized locally, and refreshed/running (or stopped/pending). A successful pull alone does not prove that an existing process serves the updated code.

Leave task branches in place unless cleanup was explicitly authorized.

## Observed repository settings

Inspection on November 1, 2026 found:

- Repository: `ShirFeld/StayFinder`; default branch: `main`.
- Effective rules require a PR and all five checks above, with an up-to-date base.
- Legacy branch protection returned "Branch not protected"; the effective rulesets still enforce the requirements. Inspect both mechanisms rather than treating that response as unprotected access.
- Native auto-merge was enabled at the repository level as part of the user's workflow-configuration request. Squash merges are allowed. No per-PR auto-merge was enabled by this configuration task.

These are dated observations, not a guarantee of future settings. Re-read live settings before arranging an unattended merge. Configuring this workflow does not publish its local files or schedule any PR to merge.
