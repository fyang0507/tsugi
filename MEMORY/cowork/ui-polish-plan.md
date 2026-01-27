# UI Polish Plan: SkillForge → Tsugi

## Overview

Preparing for hackathon by transforming the UI from functional to impressive. Three main areas:
1. Visual identity (logo, banner, favicon)
2. Overall UI polish (color system, effects, animations)
3. Welcome screen redesign (landing page as elevator pitch)

---

## Visual Assessment

### Current State

**Landing Page:**
- Extremely minimal - just title, tagline, and API key form
- Pure black background with no visual interest
- No branding, no imagery, no compelling narrative

**Main Chat UI:**
- **Strengths**:
  - Clean layout with good information hierarchy
  - User messages (blue) vs assistant (dark gray) distinction works
  - Tool outputs with colored status dots (green=shell, blue=search) are useful
  - Metrics bar at bottom is informative
  - Comparison mode with orange/teal drop zones is visually clear

- **Weaknesses**:
  - Everything is monochromatic zinc - no personality
  - The "Codify as Skill" green button is the only accent that pops
  - Sidebar feels flat and text-heavy
  - Empty state icon is generic
  - No visual celebration when skills are created

---

## 1. Visual Identity

### Name Change
- **From**: SkillForge
- **To**: Tsugi (次) - Japanese for "next"
- **Rationale**: Short, memorable, ties into "Run 1 → Run 2" concept

### Logo Prompts for AI Image Generation

**Primary Option (Abstract Mark):**
```
Minimalist logo for "tsugi" (次), an AI developer tool. Abstract the kanji 次 into two overlapping chevrons pointing forward, suggesting "next iteration." Single gradient stroke from indigo (#6366f1) to violet (#8b5cf6). Dark background friendly. Must work at 16px. Vector, no text.
```

**Wordmark Option:**
```
Wordmark "tsugi" in lowercase, clean geometric sans-serif. The letter "g" stylized with a circular loop suggesting a learning cycle. Gradient accent on the loop from purple to pink. White text on dark background. Modern developer tool aesthetic.
```

### GitHub Banner Prompt
```
GitHub social preview 1280x640 for "tsugi" AI framework. Dark gradient background (#09090b to #18181b). Left side: logo and "tsugi" wordmark. Right side: minimal diagram showing "Run 1" with many nodes, arrow, "Run 2" with few nodes - visualizing efficiency gain. Tagline: "Explore once. Exploit next." Subtle grid pattern. Purple/blue glow accents.
```

### Favicon Prompt
```
16x16 and 32x32 favicon for "Tsugi". Simplified 次 kanji or abstract "T" letterform with forward chevron. High contrast, works on both light and dark browser tabs. Single color with optional gradient.  Sharp edges, pixel-perfect at small sizes.
```

---

## 2. UI Polish - Color System & Effects (OUTDATED)

### New Color Palette

```css
/* Brand gradient - use sparingly for CTAs and highlights */
--gradient-brand: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);

/* Glow effects */
--glow-brand: 0 0 20px rgba(139, 92, 246, 0.3);
--glow-success: 0 0 20px rgba(16, 185, 129, 0.3);

/* Background enhancement */
--bg-gradient: radial-gradient(ellipse at top, rgba(139, 92, 246, 0.15) 0%, transparent 50%);
```

### Component Updates

| Component | Current | Proposed Change |
|-----------|---------|-----------------|
| **Landing bg** | Flat `#0a0a0a` | Subtle radial gradient with purple glow center |
| **Header title** | Plain white text | Gradient text or logo mark |
| **Sidebar** | Solid `zinc-900` | Glass effect: `bg-zinc-900/70 backdrop-blur-md` |
| **Skill cards** | Text-only | Add icon + subtle glow border on hover |
| **Empty state** | Gray lightbulb | Animated gradient orb or custom illustration |
| **"Codify" button** | Static green | Add subtle pulse animation on hover |
| **Skill Created** | Green bar | Add confetti or celebration micro-animation |
| **Mode toggle** | Plain buttons | Pill toggle with smooth transition |

### Glassmorphism Pattern
```css
.glass-panel {
  background: rgba(24, 24, 27, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(63, 63, 70, 0.5);
}
```

### Gradient Text Pattern
```css
.gradient-text {
  background: linear-gradient(to right, #ffffff, #a1a1aa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

## 3. Welcome Screen Redesign (DONE)

### Structure

```
┌───────────────────────────────────────────────────────────────┐
│  [Logo]  tsugi                              [GitHub] [Docs]   │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                    ✦ tsugi                                    │
│            Explore once. Exploit next.                        │
│                                                               │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │                                                          │ │
│  │   [Visual: Animated diagram]                             │ │
│  │                                                          │ │
│  │   RUN 1                           RUN 2                  │ │
│  │   ┌─────────────┐                 ┌─────────────┐        │ │
│  │   │ Research    │                 │ ✓ Use Skill │        │ │
│  │   │ Learn       │    ───────►     │ Execute     │        │ │
│  │   │ Execute     │    codify       │             │        │ │
│  │   │ Codify      │                 │  5x faster  │        │ │
│  │   └─────────────┘                 └─────────────┘        │ │
│  │        45s                              8s               │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                               │
│                  ┌─────────────────────┐                      │
│                  │   Get Started →     │  ← gradient btn      │
│                  └─────────────────────┘                      │
│                                                               │
│          Paste your Google AI API key to begin                │
│          ┌────────────────────────────────────────┐           │
│          │ ••••••••••••••••                       │           │
│          └────────────────────────────────────────┘           │
│          Get one free from Google AI Studio                   │
│                                                               │
├───────────────────────────────────────────────────────────────┤
│  How it works:                                                │
│  [1. Execute] → [2. Learn] → [3. Reuse] → [4. Compound]       │
└───────────────────────────────────────────────────────────────┘
```

### Key Messaging
- **Headline**: "Explore once. Exploit next."
- **Value prop visualization**: Show Run 1 (45s, many steps) vs Run 2 (8s, few steps)
- **CTA**: Gradient button "Get Started →"

### Visual Elements Needed
1. Logo/wordmark at top
2. Animated or static diagram showing the learning loop
3. Gradient CTA button
4. Subtle background glow/gradient
5. Optional: Feature cards at bottom

---

## Implementation Order

### Phase 1: Welcome Screen (Highest Impact)
- [x] Create new landing page layout
- [x] Add gradient background
- [x] Build Run 1 vs Run 2 visualization
- [x] Style gradient CTA button
- [x] Add feature highlights section

### Phase 2: Color System & Effects
- [x] Update globals.css with new color variables
- [x] Apply glassmorphism to sidebar
- [x] Add gradient text to headers
- [x] Update button styles with hover glow
- [x] Add micro-animations for skill creation

### Phase 3: Branding Updates
- [x] Rename SkillForge → Tsugi throughout codebase
- [x] Update page titles and meta tags
- [x] Add logo/favicon (once created)
- [x] Update GitHub repo description and banner

---

## Files to Modify

- `src/app/page.tsx` - Landing page
- `src/app/globals.css` - Color system, effects
- `src/app/layout.tsx` - Page title, meta
- `src/components/ForgeDemo.tsx` - Header branding
- `src/components/Sidebar.tsx` - Glass effect
- `src/components/ChatMessage.tsx` - Skill creation celebration
- `public/` - Logo, favicon assets

---

## 4. Demo Video (3 minutes)

### Video Structure

| Section | Time | Content |
|---------|------|---------|
| **Hook** | 0:00-0:30 | Opening speech (problem → solution → tagline) |
| **Demo Part 1** | 0:30-1:30 | Run 1: YouTube→Notion task (full exploration, show Gemini grounding) |
| **Demo Part 2** | 1:30-2:30 | Run 2: Same task with skill (dramatic speedup, highlight metrics) |
| **Wrap-up** | 2:30-3:00 | Conclusion + future vision |

### Opening Speech (~30s, ~70 words)

> "LLMs are incredibly capable - they can research, plan, execute, and self-correct. But they're stateless. Every conversation starts from zero.
>
> Tsugi changes that.
>
> When an agent completes a task for the first time, Tsugi reflects on the trajectory and distills reusable skills. The next time? It skips the research and executes directly.
>
> Explore once. Exploit next.
>
> Let me show you."

### Demo Task: YouTube → Notion Curation

**Why this task:**
- Shows Gemini's unique `urlContext` and `googleSearch` grounding
- Has clear before/after metrics (45s → 8s)
- Relatable use case (everyone curates content)

**Run 1 highlights to show:**
- Agent researching YouTube channel IDs
- Gemini analyzing video URLs directly (urlContext)
- Agent writing Python scripts to fetch RSS feeds
- Skill suggestion appearing after completion
- Click "Codify as Skill"

**Run 2 highlights to show:**
- Same prompt, but agent finds existing skill
- Skips research, executes directly
- Dramatic time/token reduction in metrics bar
- Side-by-side comparison view

### Closing Speech (~30s)

> "What you just saw: the same task, 5x faster, with better reliability.
>
> Tsugi isn't about building smarter agents - Gemini is already smart. It's about building agents that *remember* what worked.
>
> Every successful run becomes a skill. Every skill compounds. That's Tsugi.
>
> Explore once. Exploit next."

### Gemini/DeepMind Judge Appeal

**Highlight these Gemini-specific features:**

1. **Built-in Grounding** - Agent uses `googleSearch` and `urlContext` natively
   - *"Tsugi leverages Gemini's native grounding - no external search APIs needed"*

2. **URL Context for YouTube** - Agent analyzes video pages directly
   - *"Gemini's urlContext lets the agent understand YouTube content without transcription APIs"*

3. **KV Caching** - Mention the efficiency
   - *"With Gemini's context caching, subsequent runs reuse cached context - reducing cost and latency"*

4. **Long Context** - Skills can include detailed procedural knowledge
   - *"Gemini's long context window lets us store rich, detailed skills"*

**Key framing:**
> "Tsugi is built specifically for Gemini. It exploits Gemini's unique strengths - native grounding, URL understanding, and context caching - to create agents that genuinely learn from experience."

### Video Production Tips

**Recording:**
- QuickTime (Mac built-in) or OBS Studio (free)
- Record at 1x speed, speed up waiting/loading to 4x-8x in edit

**Editing:**
- iMovie (Mac, free) - sufficient for hackathon
- CapCut (free) - easy text overlays
- DaVinci Resolve (free) - pro-grade if needed

**Tips:**
- Add text overlays at key moments ("Run 1: Learning...", "Skill codified!", "Run 2: 5x faster")
- Keep transitions simple (cuts only)
- Maintain voiceover at consistent volume over sped-up sections
- Show metrics bar prominently during comparison

### Voice & Production Decisions

**Personal voice vs TTS:**
- **Recommendation: Personal voice.** Hackathon judges want to see the builder's passion. Accent, natural enthusiasm, and small imperfections feel authentic. TTS sounds polished but sterile—signals "I didn't want to put myself out there."
- If worried about delivery, record multiple takes and pick the best.

**AI video generation (Veo) for non-demo parts:**
- Could work for a stylized intro (5-10 seconds), but risky:
  - May feel overproduced for hackathon context
  - Judges may wonder if polish compensates for weak substance
  - Time on Veo = time not refining the demo
- **Better approach:** Personal voice + real demo footage + minimal text overlays. Let the product speak.

---

## 5. Problem Framing & Messaging Guide

*Discussion notes on how to articulate Tsugi's value proposition.*

### The Core Problem

> **"Smart models don't know *your* context."**

No matter how capable the base model:
- It doesn't know your company names Slack channels `#proj-{client}-{phase}` not `#{client}-project`
- It doesn't know California requires earthquake hazard disclosure but Texas doesn't
- It doesn't know you categorize Uber rides as "Travel" not "Transportation"
- It doesn't know the Stripe API returns `amount` in cents, not dollars (and you learned that the hard way)

### Two Types of Knowledge

Skills encode two distinct knowledge types:

| Type | Source | What it encodes |
|------|--------|-----------------|
| **Procedural** | Agent-discovered through trial-and-error | "The Notion API needs `Content-Type: application/json` AND `Notion-Version` header—I tried without and got a cryptic 400 error" |
| **Preferences** | Human-guided through correction | "No, don't put meeting notes in General—we use `#team-{name}-sync` for those" |

### The First-Run Problem

When an agent tackles a new task:

**1. It explores** (procedural discovery)
- Googles "how to get YouTube channel RSS feed"
- Tries the obvious URL pattern—doesn't work
- Finds a StackOverflow answer from 2019—deprecated
- Finally discovers you need the channel ID, not the handle
- Learns the feed URL format: `https://www.youtube.com/feeds/videos.xml?channel_id=...`
- *45 seconds of valuable discovery—but painful to repeat*

**2. It needs your guidance** (preference learning)
- Agent: "I'll save this to your Documents folder"
- You: "No, put it in Dropbox/Projects/YouTube-Research"
- Agent: "I'll title it 'YouTube Videos Summary'"
- You: "Use the format `YYYY-MM-DD_channel-name_digest`"
- *Your preferences are priceless—but usually lost next session*

### Why This Is Universal

**The accountant:**
- *Procedural:* QuickBooks exports dates as MM/DD/YYYY but the tax software needs YYYY-MM-DD. The agent figures this out after the first import fails.
- *Preferences:* "We always code client dinners as 'Meals - Client Entertainment', never just 'Meals'."

**The real estate agent:**
- *Procedural:* The MLS portal times out if you don't click "Stay Logged In" every 15 minutes. Agent learns to refresh proactively.
- *Preferences:* "In Texas we don't need the lead paint disclosure for post-1978 builds, but in California we still include it as a courtesy."

**The developer:**
- *Procedural:* This API returns 200 OK even on errors—you have to check `response.success` field. Agent learns after debugging a "successful" failure.
- *Preferences:* "We use `snake_case` for database columns but `camelCase` in the API response. Always transform."

**The content creator:**
- *Procedural:* YouTube's algorithm buries videos uploaded between 2-4 AM PST. Agent learns to schedule for 9 AM.
- *Preferences:* "My audience hates clickbait. Never use ALL CAPS or more than one emoji in titles."

### Key Insight

> A bare agent, no matter how smart, can't know:
> - That the Stripe webhook retries 3 times with exponential backoff (procedural—learned from logs)
> - That you want prices displayed as "$X.XX" not "X.XX USD" (preference—you told it once)
>
> **Tsugi captures both.** First run = learning. Every run after = execution.

### Balanced Pitch (for video/README)

> "When an AI agent tackles a new task, two things happen.
>
> First, it *explores*. It researches, tries approaches, hits dead ends, and self-corrects until something works. That's valuable discovery—but expensive to repeat.
>
> Second, it *learns your context*. You correct its assumptions. You tell it your taxonomy, your workflow, the rules specific to your domain. That guidance is priceless—but usually lost.
>
> Tsugi captures both.
>
> The procedural knowledge the agent discovered through trial and error. The preferences you taught it through correction. Both become reusable skills.
>
> Next run? No exploration. No re-teaching. Just execution."

### Key Phrases to Use

- "Explore once. Exploit next."
- "Procedural knowledge + personal preferences"
- "Agents that remember what worked"
- "First run learns. Every run after executes."
- "Your corrections aren't lost—they become skills."
- "Trial-and-error distilled into direct execution."

---

## 6. Hackathon Strategy & Assessment

*Honest evaluation against Gemini API Developer Competition criteria.*

### Competition Context

- **Participants:** 21,397 registered
- **Prize Pool:** $100k total ($50k grand prize)
- **Deadline:** February 9, 2026, 5:00 PM PST
- **Source:** https://gemini3.devpost.com/

### Judging Criteria Analysis

| Criterion | Weight | Tsugi Strength | Assessment |
|-----------|--------|----------------|------------|
| **Technical Execution** | 40% | ★★★★☆ | Strong Gemini integration (grounding, urlContext, KV caching). Dual-agent architecture is sophisticated. Working product with real metrics. |
| **Innovation/Wow Factor** | 30% | ★★★☆☆ | "Agents that learn" is compelling, but memory/learning systems exist. Differentiation: *codified skills* vs raw memory. Need to make distinction sharp. |
| **Potential Impact** | 20% | ★★★★☆ | Universal problem with concrete examples. 5x speedup is tangible. Generalizable across professions. |
| **Presentation/Demo** | 10% | TBD | Plan is solid. Execution determines this. |

### Strengths

1. **Solves a real, universal problem** — Not a toy demo
2. **Gemini-native story** — Uses grounding, caching, not just "another wrapper"
3. **Memorable tagline** — "Explore once. Exploit next."
4. **Measurable results** — 45s → 8s is concrete, demonstrable

### Concerns to Address

1. **21k participants** — ~100+ serious submissions competing for top 3
2. **Innovation criterion (30%)** — Judges may have seen "agents with memory." Must hammer *skill codification* distinction.
3. **Current UI** — Functional but not "wow." Polish matters for that 30%.
4. **Gemini version** — Confirm using latest Gemini model. Hackathon emphasizes new capabilities.

### Outcome Probability Estimate

| Outcome | Probability | Notes |
|---------|-------------|-------|
| **Honorable Mention** ($2k) | ~40-50% | Achievable with clean execution |
| **Top 3** ($10k-$50k) | ~15-20% | Requires polish + narrative clarity |
| **Grand Prize** ($50k) | ~3-5% | Needs everything to align + luck |

### What Increases Odds

**High Priority:**

1. **Nail the "not just memory" distinction**
   - One-liner judges remember: *"Memory is retrieval. Skills are execution."*
   - Show that skills encode *how to do things*, not just *facts to recall*

2. **Ship the UI polish**
   - First impressions matter for "wow factor" (30% of score)
   - Landing page is the first thing judges see

3. **Confirm Gemini 3 / latest model**
   - If not on latest, migrate
   - Mention specific Gemini capabilities in demo

4. **Video opening 10 seconds**
   - Determines if judges pay attention
   - Hook must land immediately

**Medium Priority:**

5. **Comparison mode prominence**
   - Side-by-side Run 1 vs Run 2 is your strongest visual
   - Make it unmissable in demo

6. **Concrete metrics on screen**
   - Time saved, tokens saved, steps skipped
   - Numbers stick in judges' minds

### Key Differentiators to Emphasize

When judges ask "how is this different from X with memory?":

| Other Approaches | Tsugi's Difference |
|------------------|-------------------|
| RAG / Vector memory | Retrieves facts → Tsugi retrieves *procedures* |
| Conversation history | Raw logs → Tsugi has *distilled, actionable* skills |
| Fine-tuning | Expensive, static → Tsugi is cheap, runtime, incremental |
| Prompt templates | Manual, fragile → Tsugi is auto-generated from real execution |

**The core distinction:**
> "Memory systems retrieve information. Tsugi retrieves *capability*. The skill doesn't say 'here's what I learned'—it says 'here's exactly how to do it again.'"

---

## 7. Messaging Delivery Strategy

*How to deliver the differentiator across channels with no face time with judges.*

### Channel Priority

| Channel | Judges Will See? | Attention Level | Purpose |
|---------|------------------|-----------------|---------|
| **Video** | 100% guaranteed | High (but brief) | Primary vehicle — show AND tell |
| **README** | ~70% will skim | Medium | Reinforce with technical depth |
| **Landing page** | ~30% might visit | Low (quick scan) | One-liner hook, visual credibility |

### Video (PRIMARY — must include)

The one guaranteed touchpoint. Differentiator must land both verbally and visually.

**Revised Video Structure:**

```
0:00-0:10  Hook: "LLMs are stateless. Every run starts from zero."
0:10-0:25  Differentiator: "Memory retrieves facts. Tsugi captures procedures."
0:25-0:30  Tagline: "Explore once. Exploit next. Let me show you."
0:30-1:30  Demo Run 1 (exploration, grounding, skill codification)
1:30-2:20  Demo Run 2 (skill lookup, direct execution, metrics)
2:20-2:40  Comparison view (side-by-side, numbers on screen)
2:40-2:55  Closing: "Skills, not memory. That's Tsugi."
2:55-3:00  End card with repo link
```

**Key moments for text overlays:**
- `[0:15]` "Memory retrieves. Skills execute."
- `[1:25]` "Skill codified ✓"
- `[2:15]` "5x faster"
- `[2:40]` "Skills = executable knowledge"

**Alternative placement** — right after Run 2 speedup:
> "That wasn't retrieval. The agent didn't remember facts—it knew exactly what to do."

### README (REINFORCEMENT — comparison table)

For judges who dig deeper after watching video.

```markdown
## How Tsugi Differs

| Approach | What it stores | What agent gets |
|----------|---------------|-----------------|
| RAG / Vector DB | Facts | "Here's relevant info" |
| Conversation history | Raw logs | "Here's what happened before" |
| **Tsugi Skills** | Procedures | "Here's exactly how to do it" |

> Memory is retrieval. Skills are execution.
```

### Landing Page (BONUS — one-liner)

Don't over-explain. Plant the seed for judges who visit the live app.

**Under the main tagline:**
```
Explore once. Exploit next.

Skills, not memory. Procedures, not facts.
AI agents that know how—not just what.
```

**Or more minimal:**
```
Explore once. Exploit next.

Turn trial-and-error into direct execution.
```

### Message Consistency Checklist

Ensure the same core idea appears in all three:

| Channel | Message Form |
|---------|--------------|
| **Video (verbal)** | "Memory retrieves facts. Tsugi captures procedures." |
| **Video (overlay)** | "Memory retrieves. Skills execute." |
| **README (table)** | RAG stores facts → Tsugi stores procedures |
| **Landing (tagline)** | "Skills, not memory." |

All point to the same insight: **Tsugi gives agents executable knowledge, not just retrievable information.**

---

## 8. Naming Discussion Brief

*Context document for discussing naming with design partners.*

### What it does (one paragraph)

An agentic framework where AI agents learn from their own execution. **Run 1**: Agent explores, hits dead ends, self-corrects, and eventually succeeds—while also receiving human guidance on preferences. **Run 2**: Agent looks up the codified skill and executes directly, skipping all the trial-and-error. The tagline: **"Explore once. Exploit next."**

### Core concepts to evoke

- **Progression / iteration** — "next run is better"
- **Learning from experience** — not memory retrieval, but skill acquisition
- **Efficiency through repetition** — first time is expensive, every time after is cheap
- **Compounding** — skills build on skills

### Current candidate: "Tsugi" (次)

- Japanese for "next"
- Short, memorable, unique in the AI space
- Ties directly to "Run 1 → Run 2" concept
- Works well visually (logo can abstract the kanji)

### The concern

- Non-Japanese speakers may not know how to pronounce it (tsoo-gee)
- Could feel pretentious or unclear in verbal contexts (pitches, podcasts, word-of-mouth)
- Risk: people avoid saying it, reducing organic spread

### What we need from a name

| Must have | Nice to have |
|-----------|--------------|
| Short (1-2 syllables ideal, 3 max) | Evokes "next" or "progression" |
| Easy to pronounce in English | Available as .com or .ai domain |
| Not already saturated in AI/dev tools | Works as a verb ("I tsugi'd that workflow") |
| Works at 16px (favicon-friendly) | Has visual/logo potential |

### Questions for discussion

1. Does "Tsugi" work despite the pronunciation barrier? Is the uniqueness worth it?
2. If we pivot, what English alternatives capture "next iteration" or "learn once, use forever"?
3. Are there other short foreign words (any language) that convey progression/learning and are easier to pronounce?

### Possible directions to explore

- **Literal "next"**: Nxt, Nexi, Nexo (but likely taken)
- **Learning/skill**: Drills, Reps, Encore
- **Iteration**: Loop, Cycle, Redux (taken)
- **Japanese alternatives**: Kurikaeshi (繰り返し, "repetition" — too long), Narau (習う, "to learn")
- **Other languages**: Encore (French, "again"), Wieder (German, "again"), Otra (Spanish, "another")



1. Deep Teal → Cyan
#0d9488 → #22d3ee

Clean, technical, fresh. Stands out without feeling trendy. Works well on dark backgrounds and has good contrast.

2. Amber → Gold
#d97706 → #fbbf24

Warm, premium, ties into Japanese aesthetics (gold leaf, autumn). Unexpected for a dev tool — memorable. The "next" concept could evoke sunrise/dawn.

3. Coral → Peach
#f43f5e → #fb923c

Modern, warm, human. Less cold than typical dev tools. Would pair nicely with the brush-stroke logo aesthetic.

4. Electric Blue (monochrome)
#0ea5e9 → #38bdf8

Classic tech color but cleaner than violet. Could go almost monochrome — white text, blue accents only. Minimal, confident.

5. Warm White + Single Accent
Let the logo breathe. Near-white text (#f4f4f5), dark navy background, with just one accent color (teal, gold, or coral) used sparingly for CTAs and highlights. The AlphaQubit example actually uses this — mostly cream/white with subtle colored orbs.

My recommendation
Amber/Gold or Teal — both are distinctive and tie to meaning:

Gold: "Next" = sunrise, progression, value compounding
Teal: Fresh, technical precision, forward movement