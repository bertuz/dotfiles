---
name: daily-scrum-summary
description:
  Generate a daily scrum summary for the current user based on their Jira tasks updated in the last 48 hours.
  Outputs a YAML block ready to paste into Obsidian, highlighting blockers and PRs needing review.
---

Generate a concise daily scrum summary by querying Jira and GitHub for the user's recent work. The output is a
YAML block suitable for Obsidian notes.

## Required MCP connections

- **mcp-atlassian**: Jira access for issue search and details.
- **GitHub MCP** (optional): PR details if development info is linked.

## Steps

1. **Query Jira** for issues updated in the last 48 hours assigned to the current user:
   ```
   jql: assignee = currentUser() AND updated >= -2d ORDER BY updated DESC
   fields: summary, status, priority, updated, issuetype
   ```
2. **Check for blockers**: search for issues with status `Blocked` or similar.
3. **For each issue**, gather:
    - Issue key and summary.
    - Current status (In Progress, Code Review, Blocked, etc.).
    - Linked PRs via `get_issue_development_info`.
    - Comments if needed to identify blockers.
4. **Calculate review age**: if a PR has been open > 2 days without approval, flag it for urgent review.
5. **Generate YAML output** following the template below.

## Output template

```yaml
# Daily YYYY-MM-DD

- ticket: https://jira.tid.es/browse/<ISSUE_KEY>
  descripcion: >
    <One-liner describing what the task is about, in Spanish, conversational tone>
  estado: <In PR | En progreso | Bloqueado | Code Review>
  prs:
    - <PR URL 1>
    - <PR URL 2>
  bloqueos: <ninguno | descripción del bloqueo>
  nota: "<optional warning if review is urgent or target date is close>"
```

## Rules

- Output in **Spanish** using a conversational tone suitable for reading aloud in a daily standup.
- Keep descriptions short (1-2 sentences max).
- Always include the Jira ticket URL as header.
- List all open PRs linked to each ticket.
- If a PR has been open for more than 2 days without approval, add a `nota` field warning about needing review.
- If a target date is within 7 days, mention it in `nota`.
- Group related PRs under the same ticket.
- Do not include tickets that are Done/Closed unless explicitly requested.
- If Jira connection fails, inform the user and ask them to retry.

## Example output

```yaml
# Daily 2026-05-07

- ticket: https://jira.tid.es/browse/O2DE-9731
  descripcion: >
    Limpieza de código en front para eliminar el campo `eSimStatus` que ya borró backend.
    Lo he hecho al 100% con IA, y de paso he montado el harnessing del repo.
  estado: En PR, pendiente de revisión
  prs:
    - https://github.com/Telefonica/webapp/pull/6296
    - https://github.com/Telefonica/webapp/pull/6294
  bloqueos: ninguno

- ticket: https://jira.tid.es/browse/O2DE-9805
  descripcion: >
    Cambios de URL para webviews legacy de CoMS en E2E2, pedido por la OB para el ABAC Drop 2.
  estado: En PR, pendiente de revisión
  nota: "⚠️ target date: 13 mayo - si se puede revisar hoy mejor"
  prs:
    - https://github.com/Telefonica/unified_config/pull/12853
  bloqueos: ninguno
```

## Failure handling

- **Jira not connected**: inform the user that MCP connection to Jira is required and ask them to check
  configuration.
- **No issues found**: report "No hay tareas actualizadas en las últimas 48 horas."
- **GitHub info unavailable**: still output the ticket info, just omit PR links and note that dev info could
  not be retrieved.
