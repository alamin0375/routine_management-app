# PRODUCT_REQUIREMENTS.md

Product requirements for the AI-Powered Routine Management App. Companion to [CLAUDE.md](CLAUDE.md), which covers technical direction. This document covers *what* we build and *why*; it should be updated as product decisions evolve.

## 1. Target Users

### Primary personas

**The Overloaded Student**
- High school / university student juggling classes, assignments, exams, and part-time work.
- Knows *what* they should do (study blocks, sleep schedule, exercise) but struggles with consistency.
- Motivated by streaks, visible progress, and exam-period structure.
- Price-sensitive — most will stay on the free tier.

**The Busy Professional**
- Working adult trying to fit personal goals (fitness, learning, side projects) around a fixed work schedule.
- Time-poor: won't tolerate fiddly setup or heavy daily data entry.
- Values insights ("you consistently skip evening workouts — try mornings?") over gamification.
- Willing to pay for something that demonstrably saves time or improves consistency.

**The Habit Rebuilder** (secondary)
- Someone recovering structure after a disruption — new job, new city, post-burnout, new parent.
- Needs flexible, forgiving routines rather than rigid schedules; harsh streak-breaking mechanics will drive them away.

### Who this is NOT for (v1)

- Teams/families coordinating shared schedules (future possibility).
- Clinical use (ADHD coaching, therapy adherence) — adjacent but requires care we can't commit to in v1.

## 2. Main Problem It Solves

**People know what their ideal day looks like but fail to execute it consistently — and existing tools don't help them adapt when life gets in the way.**

Breaking that down:

1. **Blank-page problem.** Building a realistic routine from scratch is hard. Most people either over-plan (unsustainable 5am-miracle-morning schedules) or under-plan (vague intentions).
2. **Consistency problem.** Motivation decays after ~2 weeks. Generic reminders become noise and get ignored.
3. **Rigidity problem.** Life is irregular — an exam week, a business trip, a sick day. Most habit apps treat a missed day as failure, which triggers abandonment ("I broke my streak, why bother").
4. **Insight problem.** Users can't see *why* they fail. Was the routine too ambitious? Wrong time of day? Existing apps log data but don't interpret it.

**Our differentiator:** AI closes the loop. It helps build a *realistic* routine (solves 1), adapts reminders and difficulty over time (solves 2), suggests adjustments instead of punishing misses (solves 3), and turns tracking data into plain-language weekly insights (solves 4).

## 3. Free Version Features

The free tier must be genuinely useful — it drives adoption, retention, and word of mouth.

- Create up to **3 active routines** (e.g., Morning, Study, Evening).
- Unlimited tasks/habits within a routine.
- Daily checklist view with one-tap completion.
- Basic reminders (fixed-time notifications).
- Streak tracking and a simple completion calendar.
- **Limited AI:** routine templates + one AI-generated routine suggestion per week.
- Basic weekly summary (numbers only: completion %, best/worst day).
- Data export (CSV) — users own their data on every tier.

## 4. Premium Version Features

Premium sells **the AI coach**, not basic functionality.

- **Unlimited routines** and routine archiving.
- **AI Routine Coach:**
  - Unlimited AI routine generation and refinement via chat ("I have exams in 2 weeks, rebalance my week").
  - Adaptive suggestions: AI proposes changes based on actual completion patterns.
  - Smart rescheduling: when a day is disrupted, AI proposes a salvage plan for remaining hours.
- **AI Weekly Insights:** plain-language analysis of patterns, bottlenecks, and wins, with concrete suggestions.
- **Flexible streaks:** grace days, "vacation mode," and effort-weighted streaks (forgiving mechanics as a paid comfort feature).
- **Smart reminders:** timing adapts to when the user actually completes tasks.
- Calendar integration (Google Calendar / Outlook two-way sync).
- Advanced stats: trends over months, per-task success rates, time-of-day heatmaps.
- Priority support.

**Pricing hypothesis (to validate):** ~$4–6/month or ~$36–48/year, with a student discount. AI features have real inference costs, so free-tier AI must stay capped.

## 5. User Journey

### First session (activation)
1. **Sign up** (email or OAuth). Minimal friction — no long survey.
2. **Onboarding chat (2–3 questions):** "What's your main goal?", "What does your typical day look like?", "When do you usually have free time?"
3. **AI proposes a starter routine** — deliberately modest (3–5 tasks). User edits/accepts.
4. **First win:** user checks off their first task the same day; app celebrates it.

*Activation metric: user completes ≥1 task within 24h of signup.*

### Daily loop (habit)
1. Morning notification: today's checklist.
2. User checks off tasks through the day (one tap each).
3. Evening: optional 10-second reflection ("How did today feel? 😫–😄").
4. Streak/progress feedback on completion.

### Weekly loop (retention)
1. Sunday: weekly summary arrives (basic for free, AI insights for premium).
2. AI suggests one small adjustment ("Move reading to lunch — you've hit 0/5 evening sessions").
3. User accepts/dismisses; routine evolves.

### Upgrade moment (monetization)
- Triggered contextually, not by nagging: user hits the 3-routine cap, asks the AI a question beyond the free quota, or gets a teaser of a premium insight ("We found a pattern in your week — unlock full insights").

### Lapse & recovery (win-back)
- After 3+ missed days: a single empathetic nudge, not guilt ("Want to restart with a lighter version of your routine?"). AI offers a scaled-down routine to rebuild momentum.

## 6. MVP Features for Version 1

Ruthlessly scoped: prove the core loop — *create → follow → track → adjust* — works.

**In scope:**

1. Auth (email + one OAuth provider).
2. Routine CRUD: create/edit/delete routines with tasks (name, target time, days of week).
3. Daily checklist view with one-tap completion.
4. Streaks + simple completion calendar.
5. **One AI feature done well:** conversational routine generation at onboarding ("describe your goals → get an editable routine").
6. Fixed-time reminders (web push or email digest to start).
7. Basic weekly summary (numbers, no AI analysis yet).
8. Responsive web app (installable PWA; no native apps in v1).

**Explicitly OUT of MVP:**

- Payments/premium tier (build free experience first; instrument the upgrade moments).
- Calendar sync, adaptive reminders, AI weekly insights, smart rescheduling.
- Native mobile apps, social features, teams.

*MVP success criteria: ≥40% of signups complete a task on day 1; ≥20% still active in week 4; qualitative feedback that the AI-generated starter routine felt "realistic."*

## 7. Future Features

Roughly ordered by expected value:

1. **AI weekly insights + adaptive suggestions** (the premium core — first post-MVP milestone).
2. **Payments + premium tier** (once free-tier retention validates demand).
3. **Native mobile apps** (or polished PWA push) — reminders are far stronger on mobile.
4. **Calendar integration** (two-way sync; routines placed around real commitments).
5. **Smart rescheduling** ("my morning was derailed — replan my day").
6. **Wearable/health integrations** (auto-complete "workout" from Apple Health / Google Fit).
7. **Accountability features:** share a routine with a friend, partner check-ins.
8. **Template marketplace:** community-shared routines (exam prep, marathon training, new-parent survival).
9. **Voice/quick capture:** log completions via voice or widget.
10. **Team/family routines** (shared household or study-group routines).

## 8. Possible Risks and Challenges

### Product risks
- **Retention cliff.** Habit apps notoriously lose most users in 2–4 weeks. *Mitigation:* forgiving mechanics, lapse-recovery flow, and AI adjustments that lower the bar instead of shaming — measure week-4 retention from day one.
- **AI suggestions feel generic.** If the "AI coach" outputs boilerplate ("wake up early, drink water"), the differentiator collapses. *Mitigation:* ground every suggestion in the user's actual schedule and completion data; test prompt quality with real user scenarios before launch.
- **Crowded market.** Habitica, Streaks, Fabulous, Routinery, plus every to-do app. *Mitigation:* differentiate on adaptive AI + forgiveness, not on checklist features; nail one persona (students) before broadening.

### Technical risks
- **AI inference costs.** Unbounded free AI usage could make unit economics negative. *Mitigation:* hard caps on free tier, caching/templating common suggestions, use smaller models where quality allows.
- **Notification delivery.** Web push is unreliable across platforms (especially iOS Safari); reminders are core to the value prop. *Mitigation:* email digest fallback in MVP; prioritize mobile app if push proves inadequate.
- **Prompt injection / AI misuse.** Users may push the coach off-topic or extract harmful advice. *Mitigation:* constrain the AI to routine-related tasks; refuse medical/clinical advice; log and review edge cases.

### Business risks
- **Low willingness to pay in the student segment.** Primary persona is price-sensitive. *Mitigation:* professionals as the paying segment; student discount; annual pricing.
- **Free tier too generous (or too stingy).** Either kills conversion or kills adoption. *Mitigation:* instrument upgrade-moment triggers in MVP even before payments exist, so pricing is data-informed.

### Ethical/legal considerations
- **Wellbeing data sensitivity.** Routines + mood reflections reveal a lot about a person. GDPR/CCPA compliance, clear data policy, export/delete from day one.
- **Dark-pattern temptation.** Streak anxiety and guilt-based notifications boost short-term engagement but harm users and the brand. Explicit product stance: nudges are opt-out, tone is supportive, and "delete my data" is easy.
- **Not a medical device.** Avoid claims about treating ADHD, anxiety, or depression; include appropriate disclaimers if users bring these up with the AI coach.
