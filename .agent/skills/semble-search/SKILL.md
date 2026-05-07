---
name: semble-search
description: Semantic and hybrid code search using the semble MCP server
---

<objective>
Provide a powerful alternative to grep by using semantic and hybrid search to find code patterns, implementations, and related logic across the codebase.
</objective>

<instructions>
Use this skill when:
1. You need to find "how" something is implemented rather than just searching for a literal string.
2. You want to find code similar to a known snippet.
3. You want to explore callers or related logic that might not share the same naming convention.
4. Grep returns too many irrelevant results or no results due to minor naming differences.

The `semble` MCP server provides two main tools:
- `mcp_semble_search`: Primary search tool. Use `mode: 'hybrid'` for the best balance of keyword and semantic matching.
- `mcp_semble_find_related`: Use this after a search to explore code semantically similar to a specific result line.

When using these tools in this repository, always pass the current project path as the `repo` parameter: `/Users/chadmowery/personal/dev/dungeon-runner/nimrata-run`.
</instructions>

<process>
1. Identify the search query (natural language or code snippet).
2. Call `mcp_semble_search` with the query and the current repository path.
3. Review the results. If a specific result is promising, use `mcp_semble_find_related` to find similar implementations.
4. Combine results with `view_file` to understand the full context.
</process>
