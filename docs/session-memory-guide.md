# Session memory

The `save-session` and `recall` skills preserve engineering progress and learning discussions in UTF-8 Markdown. They are installed in the user's personal Codex skills directory; `AGENTS.md` routes the project to them.

## Save and resume

Save with `סיימנו להיום`, `תשמור מה שעשינו`, `תשמור את השיחה`, or `תשמור את הסשן`. Use `את זה תשמור` to preserve a particular explanation during an ongoing session. Equivalent requests also apply.

Resume with `RECALL`, `איפה עצרנו`, `נמשיך מאיפה שעצרנו`, or a named explanation such as `נמשיך מההסבר על ההזמנות`.

```text
docs/session-memory/
  CURRENT.md
  sessions/
    YYYY-MM-DD-HHmmss-topic/
      summary.md
      explanations.md
      conversation.md
```

`CURRENT.md` is the compact entry point. It links the latest record and names the exact engineering and learning stopping points. Older sessions remain available; repeated saves in a session update its own record and preserve prior messages.

Each `summary.md` contains decisions, actual changes, failed/rejected approaches and retry conditions, verification evidence, open tasks, the Git snapshot and a concrete next step. Each `explanations.md` preserves questions, explanations, examples, terminology and the teaching point reached. An explanation being delivered is not evidence that the user understood it.

Each `conversation.md` records available messages chronologically with speaker labels and an explicit coverage statement. Exact copied messages and authored summaries must be distinguished. A complete transcript requires an actual complete source/export; the skill cannot promise access to unavailable turns or automatic capture when a chat window closes. Tools/progress omissions and any credential redactions are recorded.

## Local storage

`docs/session-memory/` is ignored by Git and source formatting. This keeps chat and personal learning notes local while allowing the workflow guides to be versioned. Local storage is not an external backup and does not follow a fresh clone automatically. Publishing or transferring these notes is a separate requested action.

Read the personal `save-session/references/memory-format.md` when creating records. The existing `docs/conversation-checkpoint.md` remains untouched as historical context. Its latest learning checkpoint concerns Playwright fixtures; validate old `.js` references against the current `.ts` files before resuming.
