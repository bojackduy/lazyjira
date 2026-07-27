# Jira Write Smoke Checklist

Run these checks only against a non-production Jira project.

- Create a disposable issue and confirm its Jira key replaces the local draft.
- Update summary, priority, labels, description, story points, estimate, issue type, assignee, and reporter; confirm each remote value.
- Transition the issue to an available status and confirm unavailable transitions remain staged with Jira's error.
- Move the issue into a future sprint, then back to backlog.
- Add an issue link and confirm it appears in Jira.
- Rank the issue between two known backlog issues.
- Post a comment and confirm the ADF-rendered content.
- Stage a delete, press `W` once to arm it, press `Esc` to cancel, then repeat and press `W` twice to delete.
- Verify a failed operation remains staged and a successful neighboring operation is cleared.
