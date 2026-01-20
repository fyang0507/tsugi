# SkillForge Demo UX Overhaul

## Goal
Transform the chat interface into a comparison-focused demo experience that showcases Run 1 (learning) vs Run 2 (efficiency) with a skills showcase in between.

## Design Overview

### Two Modes (Toggle)
1. **Normal Mode**: Current single-pane chat interface (unchanged)
2. **Comparison Mode**: 3-pane layout for hackathon demos

### Comparison Mode Layout (Desktop)
```
+------------------------------------------------------------------+
|  HEADER: SkillForge    [Normal | Comparison]     [New Chat]      |
+------------------------------------------------------------------+
|          |                    |                    |             |
| SIDEBAR  |     LEFT PANE      |   MIDDLE PANE     |  RIGHT PANE  |
|          |     (Run 1)        |    (Skills)       |   (Run 2)    |
| Chat     |                    |                   |              |
| History  |  [Drop Zone]       |  Skills created   | [Drop Zone]  |
|          |  Drag conversation |  between runs     | Drag convo   |
| -------- |  here              |                   | here         |
| SKILLS   |                    |  [Skill Card]     |              |
| (list)   |  [Chat Messages]   |  [Skill Card]     | [Chat Msgs]  |
|          |                    |  [Skill Card]     |              |
|          |  Stats: Time/Tokens|                   | Stats        |
+------------------------------------------------------------------+
|              METRICS BAR: Time Saved | Tokens Saved              |
+------------------------------------------------------------------+
```

### Key Interactions
1. **Conversation Selection** (two methods for flexibility):
   - **Drag & Drop**: Drag conversations from sidebar into left/right slots (visually impressive for live demos)
   - **Click-to-Select**: Click conversation in sidebar, then click "Add to Left/Right" button (automation-friendly for DevTools MCP testing)
2. **Skills Panel**: Shows skills relevant to the compared conversations
3. **Metrics**: Auto-calculate after both conversations have task agent stats (excludes skill codification turns)

## Implementation Plan

### Phase 1: Layout Foundation
**Files to create:**
- `src/components/demo/DemoLayout.tsx` - 3-pane container
- `src/components/demo/ComparisonPane.tsx` - Left/Right drop zones + chat
- `src/components/demo/SkillsPane.tsx` - Middle skills showcase
- `src/components/demo/MetricsBar.tsx` - Bottom comparison metrics

**Files to modify:**
- `src/components/ForgeDemo.tsx` - Add mode toggle, conditional rendering
- `src/components/Sidebar.tsx` - Make conversations draggable

### Phase 2: Conversation Selection System
**Drag & Drop:**
- Implement drag from Sidebar conversation items
- Implement drop zones in ComparisonPane
- Visual feedback during drag (highlight drop zones)

**Click-to-Select (automation-friendly):**
- Add "selected" state to sidebar conversation items
- Add "Add to Left" / "Add to Right" buttons (visible when conversation selected)
- Load conversation messages when assigned to pane

### Phase 3: Skills Showcase
- Filter skills by creation date or conversation relationship
- Card-based display in middle pane
- Animated entrance when skills are created
- Click to expand (reuse existing modal)

### Phase 4: Metrics Dashboard
- Extract task agent completion time (before skill codification)
- Calculate: time saved, tokens saved, steps skipped
- Animated counters for visual impact
- Show percentage improvements

### Phase 5: Polish & Responsive
- Mobile: Stack panes vertically or use tabs
- Animations for pane transitions
- Loading states for conversation loading

## Component Details

### DemoLayout.tsx (~150 lines)
```tsx
interface DemoLayoutProps {
  leftConversationId: string | null;
  rightConversationId: string | null;
  onDropLeft: (id: string) => void;
  onDropRight: (id: string) => void;
}
```

### ComparisonPane.tsx (~120 lines)
```tsx
interface ComparisonPaneProps {
  conversationId: string | null;
  position: 'left' | 'right';
  onDrop: (id: string) => void;
  accentColor: 'amber' | 'emerald'; // left=amber, right=emerald
}
```
- Shows drop zone when empty
- Loads and displays conversation messages
- Shows per-conversation stats

### SkillsPane.tsx (~100 lines)
- Fetches skills via existing useSkills hook
- Displays as cards with name + description
- Animated entrance (staggered)
- Connect to existing SkillDetailModal

### MetricsBar.tsx (~100 lines)
```tsx
interface MetricsBarProps {
  leftStats: ConversationStats | null;
  rightStats: ConversationStats | null;
}
```
**Metrics displayed:**
- **Time saved**: `left.executionTime - right.executionTime`
- **Input tokens saved**: `left.promptTokens - right.promptTokens`
- **Reasoning tokens saved**: `left.reasoningTokens - right.reasoningTokens`
- **Output tokens saved**: `left.completionTokens - right.completionTokens`

Shows percentage change for each metric. Only displays when both conversations have stats. Uses animated counter components for visual impact.

## Styling

### Color Scheme (existing dark theme)
- Left pane accent: `amber-500` (learning/discovery)
- Right pane accent: `emerald-500` (efficiency/success)
- Skills pane accent: `purple-500` (knowledge)
- Metrics positive: `green-400`

### Animations (add to globals.css)
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes countUp {
  from { opacity: 0.5; }
  to { opacity: 1; }
}
```

## Data Flow

### Stats Extraction
The existing `CumulativeStats` tracks:
- `totalPromptTokens`, `totalCompletionTokens`, `totalCachedTokens`
- `totalReasoningTokens`, `totalExecutionTimeMs`, `messageCount`

**Important**: Include ALL task agent turns (mode='task'), but EXCLUDE skill codification turns (mode='codify-skill'). This ensures the comparison reflects task completion efficiency, not skill creation overhead.

### Conversation Loading
Use existing API: `GET /api/conversations/[id]/messages`
- Returns full message history with stats
- Messages include iterations and parts

## Verification Plan

### Manual Testing
1. **Toggle works**: Switch between Normal/Comparison modes
2. **Drag & drop works**: Drag conversation from sidebar, drop into pane
3. **Click-to-select works**: Click conversation, click "Add to Left/Right" button
4. **Messages load**: Assigned conversation shows its chat history
5. **Skills display**: Middle pane shows relevant skills
6. **Metrics calculate**: Bottom bar shows comparison when both panes have data
7. **Animations smooth**: Skills cards animate in, counters animate

### Automated Testing (DevTools MCP)
```
1. mcp__chrome-devtools__click - Click "Comparison" toggle
2. mcp__chrome-devtools__click - Click a conversation in sidebar
3. mcp__chrome-devtools__click - Click "Add to Left" button
4. mcp__chrome-devtools__click - Click another conversation
5. mcp__chrome-devtools__click - Click "Add to Right" button
6. mcp__chrome-devtools__take_snapshot - Verify metrics bar shows comparison
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ForgeDemo.tsx` | Add mode state, toggle UI, conditional render |
| `src/components/Sidebar.tsx` | Add draggable attribute to conversation items |
| `src/app/globals.css` | Add animation keyframes |

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/demo/DemoLayout.tsx` | 3-pane container |
| `src/components/demo/ComparisonPane.tsx` | Left/right conversation display |
| `src/components/demo/SkillsPane.tsx` | Middle skills showcase |
| `src/components/demo/MetricsBar.tsx` | Bottom metrics comparison |
| `src/components/demo/DropZone.tsx` | Reusable drop target component |
| `src/components/demo/AnimatedCounter.tsx` | Animated number display |

## Open Questions (Resolved)

- [x] Layout style → Split comparison (3-pane)
- [x] Run 2 trigger → Flexible (drag any conversation)
- [x] Mode toggle → Yes, Normal ↔ Comparison
- [x] Conversation selection → Drag from sidebar + Click-to-select
- [x] Skills location → Middle pane
- [x] Metrics timing → After task agent completes (exclude skill codification)
