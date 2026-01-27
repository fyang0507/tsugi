# Demo Video Transcript (Option B: Montage Style)

**Total Duration:** 3:00
**Structure:** Architecture explainer + deep demo + quick montage

---

## Part 1: Opening Hook (0:00 - 0:25)

**Time:** 25 seconds
**Visual:** Animated quadrant diagram (static↔evolving, fact↔experience) with Tsugi positioned in "evolving + experience" quadrant

**Voiceover:**
> "Agents today are stateless. Every session starts from zero—same research, same mistakes, same cost.
>
> Memory self-evolves but only stores facts. Skills encode procedures but in static format. Neither learns from experience.
>
> Introducing Tsugi, an agent harness that automatically bootstraps battle-tested how-tos from real experiences. Powered by Gemini 3—so future executions become faster and save tokens."

---

## Part 2: How It Works (0:25 - 0:40)

**Time:** 15 seconds
**Visual:** Animated architecture diagram

**Voiceover:**
> "Here's how it works. Tsugi runs on Gemini 3 Flash with two key capabilities: native grounding—Google Search and URL analysis built right in—and extended thinking for complex reasoning.
>
> Under the hood, a dual-agent system. The Task Agent executes your request. When it succeeds, the Skill Agent analyzes the full session and extracts reusable knowledge. Let me show you."

**Architecture Diagram (animated build):**
```
┌───────────────────────────────────────────────────┐
│                  GEMINI 3 FLASH                   │
│        Extended Thinking  •  KV Caching           │
├───────────────────────────────────────────────────┤
│                                                   │
│   ┌─────────────┐          ┌─────────────┐       │
│   │ TASK AGENT  │──────────│ SKILL AGENT │       │
│   │  (Execute)  │ success  │  (Codify)   │       │
│   └──────┬──────┘          └──────┬──────┘       │
│          │                        │               │
│   ┌──────▼────────┐        ┌──────▼──────┐       │
│   │ googleSearch  │        │  Transcript │       │
│   │  urlContext   │        │  Analysis   │       │
│   │ (Grounding)   │        │             │       │
│   └───────────────┘        └─────────────┘       │
│                                                   │
└───────────────────────────────────────────────────┘
```

**Animation sequence:**
1. Gemini 3 Flash banner appears (0:25-0:28)
2. "Extended Thinking • KV Caching" highlights (0:28-0:30)
3. Task Agent box appears with grounding tools below (0:30-0:34)
4. Arrow flows to Skill Agent on "success" (0:34-0:37)
5. Transcript Analysis appears below Skill Agent (0:37-0:40)

---

## Part 3: Run 1 - YouTube/Notion Task (0:40 - 1:35)

**Time:** 55 seconds
**Visual:** Screen recording of Run 1, sped up at 4-8x during waiting/loading

**Voiceover:**
> "I'm asking the agent to curate my favorite YouTube channels into Notion—a centralized watchlist. This is what the agent is doing out of the box.
>
> Watch the Task Agent use Gemini's native grounding—Google Search to find the RSS format, then urlContext to analyze the actual YouTube page...
>
> [hint: narrate the mistake - e.g., "It hits a 404 because it used the channel handle instead of the ID"]
>
> Extended thinking kicks in—it reasons through the error...
>
> "But it self-corrects..."
>
> [hint: narrate recovery - e.g., "Finds the channel ID, constructs the correct feed URL"]
>
> "And it succeeds. But that took [XX] seconds of trial and error."

**Text overlays:**
- `[0:50]` "googleSearch: 'YouTube RSS feed format'"
- `[1:00]` "urlContext: analyzing channel page..."
- `[1:15]` "Extended thinking: reasoning through the error..."
- `[1:25]` "Self-correcting..."
- `[1:32]` "Task complete ✓"

---

## Part 4: Skill Codification (1:35 - 1:55)

**Time:** 20 seconds
**Visual:** Screen recording showing skill suggestion appearing, user clicking "Codify as Skill"

**Voiceover:**
> "Here's where Tsugi kicks in. It detected valuable learnings from this run—the gotchas, the working solution.
>
> Now the Skill Agent takes over—it analyzes the full transcript, extracts the procedural knowledge, and writes a reusable skill file. One click. Human in the loop. Now that experience is captured."

**Text overlays:**
- `[1:40]` "Skill Agent: analyzing transcript..."
- `[1:48]` "Skill codified ✓"

---

## Part 5: Run 2 - Same Task with Skill (1:55 - 2:20)

**Time:** 25 seconds
**Visual:** Screen recording of Run 2, can run closer to real-time since it's fast

**Voiceover:**
> "Same task. Same prompt. But now the agent finds the skill.
>
> No research. No trial and error. It knows the feed URL format, knows to fetch the channel ID first.
>
> [hint: narrate what's skipped - e.g., "Skips the Google Search entirely"]
>
> Direct execution."

**Text overlays:**
- `[2:00]` "Skill found: youtube-notion-sync"
- `[2:08]` "Skipping research..."
- `[2:17]` "Done ✓"

---

## Part 6: Metrics Comparison (2:20 - 2:35)

**Time:** 15 seconds
**Visual:** Comparison mode side-by-side, metrics bar prominent

**Voiceover:**
> "[XX] seconds down to [YY]. [N]x faster. [M]% fewer tokens.
>
> And with Gemini's KV caching, repeated context is served from cache—compounding savings on every run.
>
> That's not optimization—that's the difference between exploring and executing."

**Text overlays:**
- `[2:23]` "[XX]s → [YY]s"
- `[2:27]` "[N]x faster"
- `[2:31]` "KV Cache: [Z]% context reuse"

---

## Part 7: Morning Brief Montage (2:35 - 2:50)

**Time:** 15 seconds
**Visual:** Quick montage of morning-brief task, heavily sped up (8-16x), showing key moments only

**Voiceover:**
> "Tsugi isn't just procedural knowledge—it's personalization too.
>
> Here, the agent's first attempt at a morning brief was generic. I corrected it: 'Follow this structure, send to Discord.'
>
> Tsugi captured my preferences. Next run? Exactly what I wanted, no correction needed."

**Text overlays:**
- `[2:37]` "Run 1: Generic output"
- `[2:42]` "Preferences codified"
- `[2:47]` "Run 2: Personalized ✓"

---

## Part 8: Closing (2:50 - 3:00)

**Time:** 10 seconds
**Visual:** Logo + tagline on screen, optional: quadrant diagram callback

**Voiceover:**
> "Tsugi means 'next' in Japanese.
>
> First run explores. Every run after executes.
>
> Explore once. Exploit next. Built with Gemini 3 and open-source."

**Text overlays:**
- `[2:55]` "次 = next"
- `[2:58]` "Explore once. Exploit next."

---

## Production Notes

### Timing Budget

| Part | Duration | Cumulative | Notes |
|------|----------|------------|-------|
| Opening Hook | 25s | 0:25 | Problem statement + Gemini mention |
| **How It Works** | **15s** | **0:40** | **Architecture diagram** |
| Run 1 Demo | 55s | 1:35 | Grounding tool callouts |
| Codification | 20s | 1:55 | Skill Agent handoff |
| Run 2 Demo | 25s | 2:20 | Skill execution |
| Metrics | 15s | 2:35 | KV cache callout |
| Morning Brief Montage | 15s | 2:50 | Personalization demo |
| Closing | 10s | 3:00 | Tech stack mention |

### Technical Content Checklist

- [ ] Gemini 3 Flash mentioned (Opening, How It Works, Closing)
- [ ] Native grounding explained (How It Works, Run 1)
- [ ] Extended thinking shown (Run 1 overlay)
- [ ] Dual-agent architecture explained (How It Works)
- [ ] Skill Agent handoff shown (Codification)
- [ ] KV caching mentioned (Metrics)
- [ ] Architecture diagram animated (How It Works)

### Placeholders to Fill After Recording

- [ ] Run 1 specific exploration narration
- [ ] Run 1 specific error/mistake shown
- [ ] Run 1 recovery narration
- [ ] Run 1 total time
- [ ] Run 2 time
- [ ] Speedup multiplier (Nx)
- [ ] Token savings percentage
- [ ] KV cache percentage
- [ ] Morning brief stats

### Fallback if 3:00 is Too Tight

If timing feels rushed after recording, cut Part 7 (Morning Brief Montage):
- Saves 15s of content
- Mention it as text overlay: "Also tested with: personalized briefings, Stripe API, and more."
- Use saved time to add breathing room to Run 1 or Metrics

