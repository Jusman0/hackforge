---
name: status
description: HackForge one-screen status — deadline countdown, current checkpoint and overdue items, gates, locked idea, prod URL, rubric weights, web-credit spend and the recommended next step. Use whenever the user asks where the hackathon stands or what to do next.
---

# HackForge status

Run `hackforge status --brief` (or `"${CLAUDE_PLUGIN_ROOT}/bin/hackforge" status --brief` if `hackforge` is not on PATH). If it reports no project, say so and suggest `/hackforge:kickoff`, or `cd` into the hackathon repo.

Relay this to the user in at most 5 lines, leading with time left and the next step. If a checkpoint is overdue, name it and the fastest way to close it, which is usually a cut, not more work. For detail: `hackforge checkpoint list`, `hackforge gate`, `hackforge web ledger`, `hackforge clock`.
