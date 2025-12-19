# Replay UI Implementation - Visual Guide

## Component Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    TradingTerminal.tsx                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │         MarketStatusBar (always visible)              │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ReplayModeBanner (only when isReplaying={true})      │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │ 🟨 ⏪ REPLAY MODE — TRADING DISABLED           │ │  │
│  │  │ You are viewing historical data...             │ │  │
│  │  │                                [245/1000]      │ │  │
│  │  │                    [Resume]  [Reset]           │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ReplayModeDesaturatedWrapper (isReplaying={true})    │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │ Charts & Indicators (desaturated, blue-shifted) │ │  │
│  │  │ ┌────────────────────────────────────────────┐  │ │  │
│  │  │ │                       ⏪ REPLAY           │  │ │  │
│  │  │ │                    Historical Data       │  │ │  │
│  │  │ │  (ReplayModeWatermark)                   │  │ │  │
│  │  │ │                                          │  │ │  │
│  │  │ │ 📊 TradingChart (filtered, blue-shifted) │ │ │  │
│  │  │ │   • Colors: 70% saturation               │  │ │  │
│  │  │ │   • Green → Blue                         │  │ │  │
│  │  │ │   • Red → Blue                           │  │ │  │
│  │  │ │                                          │  │ │  │
│  │  │ └────────────────────────────────────────────┘  │ │  │
│  │  │ ┌────────────────────────────────────────────┐  │ │  │
│  │  │ │ Technical Indicators (also filtered)      │  │ │  │
│  │  │ │   • All colors desaturated                │  │ │  │
│  │  │ │   • Blue tint applied                     │  │ │  │
│  │  │ └────────────────────────────────────────────┘  │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │      AnalyticsPanel (play/pause/speed controls)       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
TradingTerminal
├── MarketStatusBar ◄─ (always visible, unchanged)
├── ReplayModeBanner ◄─ (NEW) Shows when isReplaying={true}
│   ├─ Alert Icon (pulsing)
│   ├─ Message Text
│   ├─ Progress Display
│   └─ Action Buttons (Resume, Reset)
│
├── Header & Controls
│
├── ReplayModeDesaturatedWrapper ◄─ (NEW) Wraps entire chart area
│   ├─ ReplayModeWatermark ◄─ (NEW) Positioned in top-right
│   │   ├─ Large "⏪ REPLAY" text
│   │   └─ "Historical Data" subtext
│   │
│   ├─ Main Chart Area
│   │   └─ TradingChart (FILTERED: saturate(0.7), hue-rotate(-10deg))
│   │       ├─ Green → Blue
│   │       ├─ Red → Blue
│   │       └─ 70% Color Saturation
│   │
│   └─ Technical Indicators Panel
│       ├─ RSI (blue-tinted)
│       ├─ MACD (desaturated)
│       ├─ EMA (filtered)
│       └─ Other indicators (all filtered)
│
└── AnalyticsPanel (play/pause controls)
```

---

## State Flow: isReplaying

```
Initial State: isReplaying = false
│
│  User clicks [Play] in AnalyticsPanel
│  ↓
setIsReplaying(true)
│  ├─ ReplayModeBanner appears ✅
│  ├─ Chart desaturates ✅
│  ├─ Watermark appears ✅
│  └─ All state hooks update
│
During Replay: isReplaying = true
│  ├─ ReplayModeBanner shows progress
│  ├─ replayPlayback[] fills with ticks
│  ├─ Chart displays historical data
│  └─ User can pause/resume/reset
│
User clicks [Stop] or [Reset]
│  ↓
setIsReplaying(false)
│  ├─ ReplayModeBanner disappears ✅
│  ├─ Chart returns to normal ✅
│  ├─ Watermark disappears ✅
│  └─ replayPlayback[] cleared
│
Final State: isReplaying = false (back to live mode)
```

---

## Visual State Changes

### Live Mode → Replay Mode Transition

```
LIVE MODE                          REPLAY MODE
┌──────────────────────────┐      ┌──────────────────────────┐
│ (No banner)              │  →   │ 🟨 REPLAY BANNER ⚠️      │
├──────────────────────────┤      ├──────────────────────────┤
│ 📊 CHARTS (NORMAL)       │  →   │ 📊 CHARTS (DESATURATED)  │
│  Price: $45,250          │      │  Price: $45,250          │
│  ↑ +2% (GREEN)           │  →   │  ↑ +2% (BLUE) ◄─ Color  │
│  ↓ Indicator (RED)       │  →   │  ↓ Indicator (BLUE)      │
│  Full color saturation   │  →   │  70% saturation          │
│  Vibrant, live           │  →   │  Muted, blue-shifted     │
├──────────────────────────┤      ├──────────────────────────┤
│ ⚡ LIVE (green badge)    │  →   │ (no live badge)          │
└──────────────────────────┘      │ ⏪ REPLAY (watermark)    │
                                  └──────────────────────────┘
```

---

## Color Transformation

### Green Indicators in Replay Mode

```
LIVE MODE             REPLAY MODE
┌────────────────┐   ┌────────────────┐
│ GREEN          │   │ BLUE           │
│ rgb(34, 197,  │→  │ rgb(96, 165,   │
│     94)        │   │     250)       │
│ Vibrant        │   │ Neutral        │
│ Saturated      │   │ Desaturated    │
│ 100% saturation│   │ 70% saturation │
└────────────────┘   └────────────────┘

Visual Effect: UP indicators become neutral blue
              (gains not emphasized in replay)
```

### Red Indicators in Replay Mode

```
LIVE MODE             REPLAY MODE
┌────────────────┐   ┌────────────────┐
│ RED            │   │ BLUE           │
│ rgb(239, 68,   │→  │ rgb(96, 165,   │
│     68)        │   │     250)       │
│ Vibrant        │   │ Neutral        │
│ Saturated      │   │ Desaturated    │
│ 100% saturation│   │ 70% saturation │
└────────────────┘   └────────────────┘

Visual Effect: DOWN indicators become neutral blue
              (losses not emphasized in replay)
```

---

## Banner Interaction Flow

```
              ReplayModeBanner
              ┌──────────────────┐
              │ ⏪ REPLAY MODE    │
              │ 245 / 1000 ticks │
              └──────────────────┘
                  │          │
                  │          └─────────────────┐
                  │                            │
            [Resume]                       [Reset]
              │                              │
              ↓                              ↓
      Replay Continues                Replay Resets
      (pause → resume)               (stop & clear)
      └─ isReplaying stays true      └─ isReplaying = false
      └─ replayPlayback updates      └─ All UI clears
```

---

## Watermark Positioning Options

```
          TOP-LEFT                 TOP-RIGHT
      ┌──────────────┐         ┌──────────────┐
      │ ⏪ REPLAY     │         │     ⏪ REPLAY │
      │ Historical   │         │   Historical │
      │              │         │              │
      │  📊 Chart    │         │  📊 Chart    │
      └──────────────┘         └──────────────┘

        BOTTOM-LEFT              BOTTOM-RIGHT
      ┌──────────────┐         ┌──────────────┐
      │              │         │              │
      │  📊 Chart    │         │  📊 Chart    │
      │ ⏪ REPLAY     │         │     ⏪ REPLAY │
      │ Historical   │         │   Historical │
      └──────────────┘         └──────────────┘

Current Implementation: TOP-RIGHT (default)
```

---

## CSS Filter Explanation

### Desaturation Filter
```
filter: saturate(0.7) hue-rotate(-10deg) brightness(1.05)
         │             │                 │
         │             │                 └─ Slightly brighten
         │             │                    (maintain readability)
         │             │
         │             └─ Rotate hue -10deg
         │                (shift toward blue)
         │
         └─ Reduce saturation to 70%
            (mute all colors)

Visual Result:
  • Colors become less vivid
  • Overall tone shifts to cool (blue)
  • Still readable, but clearly different
```

### Color Mapping in Replay

```
Input (Live):           Filter Applied:         Output (Replay):
┌─────────────────┐     ┌──────────────────┐    ┌──────────────────┐
│ Green: #22C55E  │ →   │ saturate(0.7)    │ →  │ Blue: #60A5FA    │
│ Red: #EF4444    │     │ hue-rotate(-10°) │    │ Blue: #60A5FA    │
│ Blue: #3B82F6   │     │ brightness(1.05) │    │ Blue: #60A5FA    │
│ Yellow: #FBBF24 │     │                  │    │ Blue: #60A5FA    │
│ Purple: #A855F7 │     │                  │    │ Blue: #60A5FA    │
└─────────────────┘     └──────────────────┘    └──────────────────┘

Result: All accent colors become shades of blue (neutral)
```

---

## Integration Points in Code

### Import Location
```tsx
// File: client/src/pages/trading-terminal.tsx
// Lines: 36-38

import ReplayModeBanner from '../components/ReplayModeBanner';
import ReplayModeDesaturatedWrapper from '../components/ReplayModeDesaturatedWrapper';
import ReplayModeWatermark from '../components/ReplayModeWatermark';
```

### Banner Placement
```tsx
// File: client/src/pages/trading-terminal.tsx
// Lines: 1475-1480 (right after MarketStatusBar)

<ReplayModeBanner
  isReplaying={isReplaying}
  currentTime={replayPlayback.length}
  totalTime={worldTicks.length}
  onResume={() => resumeReplay()}
  onReset={() => stopReplay()}
/>
```

### Wrapper & Watermark Placement
```tsx
// File: client/src/pages/trading-terminal.tsx
// Lines: 2117-2880 (wraps entire chart section)

<ReplayModeDesaturatedWrapper isReplaying={isReplaying}>
  <div className="w-full h-full flex gap-3 relative">
    <ReplayModeWatermark 
      isReplaying={isReplaying} 
      position="top-right" 
      opacity={0.1} 
    />
    {/* Chart and indicators content */}
  </div>
</ReplayModeDesaturatedWrapper>
```

---

## User Journey Map

```
┌─────────────────────────────────────────────────────────────────┐
│                   USER STARTS REPLAY MODE                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    "Play" button clicked
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ↓                   ↓
            React State Updated    Visual Feedback
            isReplaying = true
                    │              ├─ Banner appears ✅
                    │              ├─ Chart filters ✅
                    │              └─ Watermark shows ✅
                    │
                    ↓
        ┌───────────────────────┐
        │  REPLAY IN PROGRESS   │
        └───────────────────────┘
                    │
         ┌──────────┼──────────┐
         │          │          │
         ↓          ↓          ↓
      [Pause]   [Speed]    [Seek]
         │          │          │
         └──────────┼──────────┘
                    │
                    ↓
        ┌───────────────────────┐
        │ USER CLICKS [Reset]   │
        └───────────────────────┘
                    │
                    ↓
            React State Updated
            isReplaying = false
                    │
         ┌──────────┴──────────┐
         │                     │
         ↓                     ↓
   All UI Clears         Mode Resets
   ├─ Banner gone       ├─ replayPlayback = []
   ├─ Filters removed   ├─ replayIndex = 0
   ├─ Watermark gone    └─ Back to live
   └─ Colors normal
                    │
                    ↓
        ┌───────────────────────┐
        │   LIVE MODE ACTIVE    │
        └───────────────────────┘
```

---

## Summary

**Three Components, One Goal: Make Replay Mode Obvious**

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  1️⃣  ReplayModeBanner                                       │
│      └─ Prominent yellow warning at page top                │
│                                                              │
│  2️⃣  ReplayModeDesaturatedWrapper                           │
│      └─ CSS filters reduce color saturation & shift hue     │
│                                                              │
│  3️⃣  ReplayModeWatermark                                    │
│      └─ Subtle reminder in chart corner                     │
│                                                              │
│  Result: Users cannot confuse replay with live trading      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

All three work together to provide multiple, independent signals that make historical mode unambiguous.
