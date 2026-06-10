---
name: commit-message
description: 'Write git commit messages in Conventional Commits format. Use when creating a commit, writing a commit message, staging changes for commit, or summarizing changes for git. Enforces the <type>(<scope>): <summary> structure with body and footer.'
argument-hint: 'Optionally describe the changes to summarize'
---

# Commit Message

## When to Use
- The user asks to commit, write a commit message, or summarize changes for git.
- Before running `git commit` on staged changes.

## Format

```
<type>(<optional scope>): <short summary>

<optional body — what & why, not how>

<optional footer — breaking changes, issue refs>
```

## Rules

- **Summary line**: imperative mood ("add", not "added"), ≤ 50 characters, no trailing period.
- **Blank line** between the summary and the body.
- **Body** (optional): wrap at ~72 characters; explain *what* changed and *why*, not *how*.
- **Footer** (optional): `BREAKING CHANGE: <desc>` for breaking changes; `Closes #123` / `Refs #123` for issues.
- Scope is optional; use a short noun for the affected area (e.g. `dashboard`, `map`, `api`).

## Allowed Types

| Type | Use for |
|------|---------|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `style` | Formatting, whitespace, no code-behavior change |
| `refactor` | Code change that is neither a feature nor a fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `build` | Build system or dependency changes |
| `ci` | CI configuration changes |
| `chore` | Tooling, maintenance, misc. |
| `revert` | Reverting a previous commit |

## Procedure

1. Inspect what changed: run `git status` and `git diff --staged` (or `git diff` if nothing is staged).
2. Pick the single most accurate `type` and an optional `scope`.
3. Write the summary line in imperative mood, ≤ 50 chars.
4. If the change needs context, add a blank line then a body explaining what & why.
5. Add a footer for breaking changes or issue references when applicable.
6. Present the message for confirmation before committing.

## Examples

```
feat(dashboard): add severity telemetry panel

docs: clarify that all feeds are mocked in README

fix(map): correct evacuation-zone overlay offset

refactor(feeds): extract mock data source into module

feat(api)!: change incident schema to v2

BREAKING CHANGE: `incident.level` replaced by `incident.severity`.
Closes #42
```
