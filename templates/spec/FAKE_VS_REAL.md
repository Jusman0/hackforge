<!-- HackForge template, copied to .hackforge/spec/FAKE_VS_REAL.md by /hackforge:spec. Shown at Gate B; keep it current at every checkpoint.
Event rules typically require the project to work as depicted in the video. Mock only non-core dependencies, and say what is mocked.
Status values:
  real    = live call or computation at demo time
  cached  = a recorded REAL output replayed (DEMO_MODE), for speed or reliability
  seeded  = realistic fixture data (no lorem ipsum)
  mocked  = fake behaviour standing in for something not built
ship/FACTS.md "What's mocked" and the README "What's real vs mocked" section are built from this table. -->

# Fake vs real: {{Name}}

Last reviewed: {{YYYY-MM-DD HH:MM tz}} by {{name}} at checkpoint {{ID}}

| Component | Status | Why | On golden path? | Judge-safe wording | Disclosed where | Swap to real |
|---|---|---|---|---|---|---|
| {{core model step (aha)}} | real | It is the product | yes, {{0:35}} | — | — | — |
| {{sponsor API}} | {{real}} | Prize requirement | yes, {{time}} | — | — | — |
| {{slow external API}} | cached | {{flaky / slow / rate-limited}} | yes | "{{Live in the app; cached in the demo for reliability}}" | README, Devpost Challenges, video caption | `DEMO_MODE=0` |
| {{users / records}} | seeded | No real users yet | yes | "{{Seeded with realistic sample data from …}}" | README | {{…}} |
| {{payments / email / notifications}} | mocked | Out of scope | no | "{{Simulated}}" | README | {{…}} |

## Rules (all ticked before Gate B and again before Gate C)
- [ ] The aha step is `real`, or `cached` real output that is disclosed
- [ ] Every sponsor integration claimed in ship/FACTS.md is `real`
- [ ] Nothing in the video shows a `mocked` component as live
- [ ] Every `cached`, `seeded` or `mocked` row has a "Disclosed where"
- [ ] DEMO_MODE behaviour matches the cached rows above

## Q&A answer (presenter memorizes it)
"{{one sentence: what is real, what is cached or simulated, and why}}"
