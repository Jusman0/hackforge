---
name: playbook
description: Evidence-based hackathon winning playbook (2025-2026) — how judging really works, real rubric weights, what wins and what judges are tired of, the IdeaScore formula and gates, sponsor-prize strategy, the 24h/48h/week checkpoint clock, demo-first rules, video/pitch/README/Devpost templates and the submission checklist. Use for any hackathon strategy, scoring, timing, pitch or submission question.
when_to_use: "Triggers: how to win a hackathon, judging criteria, pitch, demo video, Devpost, submission, sponsor prizes, what idea to pick, timeline, feature freeze."
---

# Hackathon playbook

The 12 rules (sources and detail are in the references):
1. **Parse the rubric before picking the idea.** Weights vary a lot: Anthropic-style rubrics give the demo 30%, Devpost often uses 4 × 25%, and MLH does not judge the pitch or the idea.
2. **Pass the hidden gates first.** Many events have a Stage-1 pass/fail on theme fit and required API use. Some judges never run the app, and an LLM may pre-screen the submission.
3. **Narrow user, quantified pain.** Recent winners are domain experts fixing one workflow ("weeks become 5 hours").
4. **Deterministic core, AI at the interpretation layer, visible evidence.** Show graphs, documents, citations or 3D, not chat bubbles. A human approves consequential steps.
5. **Avoid the fatigue list:** generic chatbot, chat-with-PDF, todo/notes app, display-only dashboard, frontend wrapper. If you must, rescue it with a narrow user, domain data, a visible artifact and an eval number.
6. **Write the demo script and Devpost story before the code.** Build only the golden path.
7. **Deploy a walking skeleton by about 30% of the clock.** No auth wall, and give judges the production URL.
8. **Freeze features at about 75%, finish the video by about 85%, submit by about 92%** (never later than T-30m).
9. **The 2–3 minute video:** hook, problem, demo (about half the runtime), hard part, impact. A human narrates.
10. **Sponsor tech must be load-bearing:** on screen, in the README, and in the pitch. Check the stacking rule.
11. **Disclose AI use and show how you orchestrated it.** Own the core logic you can explain in Q&A.
12. **Protect secrets and history:** `.env` ignored, a secret scan, small frequent commits.

## References (load only what the question needs)
- `references/judging.md`: judging formats, published rubrics with weights, the HackForge default rubric with anchors, hidden factors, and judge-persona cards.
- `references/ideas.md`: winner patterns, the fatigue list and rescue recipe, gates G1–G6, the IdeaScore formula, ideator directions, the saturation method, kill-switch questions, and sponsor-prize EV.
- `references/timeline.md`: minute-zero prep, checkpoint tables (24h/48h/week), demo-first rules, team protocol, how to use agents, and failure modes.
- `references/submission.md`: video constraints and timing templates, pitch structure, Devpost headings, the README outline, the submission checklist, and the Q&A drill.

In a HackForge project, these numbers are live: `hackforge clock`, `hackforge checkpoint list`, and `.hackforge/rubric.json`.
