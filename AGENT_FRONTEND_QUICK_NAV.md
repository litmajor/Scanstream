# 🎮 Agent Frontend Quick Navigation Guide

## 📍 How to Access Your New Agent Pages

### 1. Agent Roster (Browse All Agents)
**URL:** `/agent-roster`  
**What It Does:** Shows grid of all your trading agents with filters and sorting

**How to Use:**
1. Navigate to `/agent-roster` in sidebar or URL
2. Search by agent name
3. Filter by type (Physics, ML, Exit, etc.)
4. Sort by Level, Wins, Win Rate, Profit Factor, Sharpe, or Name
5. Click any agent card → goes to Agent Detail page

**Displays:**
- Agent name, level, rank
- XP progress bar
- Win rate, trades, profit factor, sharpe ratio
- Skills preview
- Achievement count

---

### 2. Agent Detail (Individual Agent Performance)
**URL:** `/agent-detail/:agentName`  
**What It Does:** Shows comprehensive stats, achievements, and risk metrics for one agent

**How to Get There:**
- From Roster: Click "View Details" or "Inspect" on any agent card
- Direct URL: `/agent-detail/BreakoutHunter` (example)
- From Leaderboard: Click agent row or "View" button

**Displays:**
- Full header with agent name, level, rank
- Mood & personality indicators
- XP progress to next level
- Performance stats (7 metrics)
- Skills tree with levels
- Abilities list
- Win/loss breakdown chart
- Risk metrics (Profit Factor, Sharpe, Max Drawdown)
- Achievements list (scrollable)
- Recent activity placeholder

**Available Actions:**
- Back to Roster button
- View achievements
- View performance metrics

---

### 3. Agent Leaderboard (Ranked Competition)
**URL:** `/agent-leaderboard`  
**What It Does:** Shows all agents in ranked table format with comprehensive metrics

**How to Use:**
1. Navigate to `/agent-leaderboard`
2. View agents ranked by default (Win Rate, descending)
3. Change sort column (Level, Wins, Profit Factor, Sharpe, Trades, Name)
4. Toggle sort direction (Asc/Desc)
5. Filter by Rank tier (Bronze → Master)
6. Search by agent name
7. Click any row → goes to Agent Detail
8. Click "View" button → goes to Agent Detail

**Table Columns:**
- **#** - Rank (🏆🥈🥉 for top 3)
- **Agent** - Name with type icon
- **Level** - Current level
- **Rank** - Tier badge (Bronze/Silver/Gold/Platinum/Diamond/Master)
- **Wins** - Green text
- **Losses** - Red text
- **Win Rate** - Progress bar + percentage
- **Profit Factor** - Color-coded (green >1.5, blue >1, red <1)
- **Sharpe Ratio** - Color-coded (green >2, blue >1, red <1)
- **Trades** - Total trades count
- **Action** - View button

**Stats at Top:**
- Total Agents
- Average Win Rate
- Total Wins (all agents combined)
- Average Sharpe Ratio

---

## 🗺️ Navigation Map

```
┌─────────────────────────────────────────┐
│         AGENT ARENA HUB                 │
│   (Existing - Visual Overview)          │
└────────────┬────────────────────────────┘
             │
      ┌──────┴────────┐
      ↓               ↓
   (ROSTER)      (LEADERBOARD)
    /agent-roster  /agent-leaderboard
    
    - Grid view      - Ranked table
    - Search/Filter  - Sort/Filter
    - Cards          - Rows
    
      ↓               ↓
      └──────┬────────┘
             ↓
      (AGENT DETAIL)
      /agent-detail/:name
      
      - Individual stats
      - Achievements
      - Performance charts
      - Back to Roster/Leaderboard
```

---

## 🎯 Common Tasks

### Task: Find Agent with Best Win Rate
1. Go to `/agent-leaderboard`
2. Ensure "Sort By" = "Win Rate"
3. Ensure sort direction = "Desc" (highest first)
4. Top agent has highest win rate
5. Click to view details

### Task: Find Agent by Type (e.g., Physics)
1. Go to `/agent-roster`
2. In "Filter" dropdown, select "Physics Agents"
3. View only physics agents
4. Can further sort or search

### Task: Track Specific Agent (e.g., "VFMD")
1. Go to `/agent-roster`
2. Type "VFMD" in search box
3. Click the VFMD agent card
4. View detailed stats, achievements, metrics
5. Check mood, personality, skills

### Task: Compare Two Agents
1. Go to `/agent-leaderboard`
2. Note agent A's stats in table
3. Click agent A → view detailed stats
4. Go back to leaderboard
5. Click agent B → view detailed stats
6. Compare side-by-side

### Task: Find Most Traded Agent
1. Go to `/agent-leaderboard`
2. "Sort By" = "Total Trades"
3. Sort descending
4. Top agent has most trades

---

## 📊 Stat Explanations

### Performance Metrics
- **Win Rate:** % of trades that were profitable
- **Wins:** Total number of winning trades
- **Losses:** Total number of losing trades
- **Total Trades:** All trades executed

### Risk Metrics
- **Profit Factor:** Gross Profit / Gross Loss (>1.5 = excellent)
- **Sharpe Ratio:** Return / Volatility (>2 = excellent)
- **Max Drawdown:** Worst peak-to-trough decline (lower better)

### Agent Progress
- **Level:** Agent level (1-50)
- **XP:** Current XP toward next level
- **Rank:** Tier (Bronze → Master)

### Skills
- Each agent has 5 skills (1-10 levels)
- Displayed as progress bars
- Higher = better at that specialty

---

## 🔄 Data Refresh

All pages auto-refresh every **30 seconds** to show latest data:
- New trades
- XP changes
- Level ups
- Stat updates

Manual refresh: Press **F5** or **Ctrl+Shift+R**

---

## 🎨 Color Coding Quick Reference

### Agent Type Colors (Borders & Icons)
- 🔴 VFMD, Opposition: Red #D62828
- 🟠 MA Crossover: Orange #F4A261
- 🟡 Physics Flow: Dark Blue #264653
- 🟢 Support Bounce: Teal #2A9D8F
- 🔵 Reversal: Cyan #4ECDC4
- 🟣 Microstructure: Purple #8338EC

### Rank Badge Colors
- **Bronze:** #CD7F32 (Starting tier)
- **Silver:** #C0C0C0 (Mid tier)
- **Gold:** #FFD700 (High tier)
- **Platinum:** #E5E4E2 (Elite)
- **Diamond:** #B9F2FF (Master)
- **Master:** #FF00FF (Legend)

### Profit Factor Colors (Leaderboard)
- 🟢 Green: >1.5 (Excellent)
- 🔵 Blue: >1.0 (Good)
- 🔴 Red: <1.0 (Needs improvement)

### Sharpe Ratio Colors (Leaderboard)
- 🟢 Green: >2.0 (Excellent)
- 🔵 Blue: >1.0 (Good)
- 🔴 Red: <1.0 (Risky)

---

## ⚙️ Sidebar Navigation

Look for these links in your sidebar (coming soon):
- **Agent Roster** → `/agent-roster`
- **Agent Leaderboard** → `/agent-leaderboard`
- **Agent Arena Hub** → `/agent-arena-hub` (existing)

---

## 🆘 Troubleshooting

### Agent data not loading?
- Check if backend API is running (`/api/agents/all`)
- Press **F5** to refresh
- Check browser console for errors (F12)

### Can't find agent page?
- Roster: Navigate to `/agent-roster`
- Leaderboard: Navigate to `/agent-leaderboard`
- Detail: Navigate to `/agent-detail/AgentName`

### Search not working?
- Ensure you're typing agent name correctly
- Search is case-insensitive
- Try searching for part of name (e.g., "break" for "BreakoutHunter")

### Sort not applied?
- Leaderboard: Click "Sort By" dropdown, select metric
- Roster: Select metric, toggle sort direction
- Default sorts are applied automatically

---

## 📱 Mobile Tips

- **Landscape mode** for best leaderboard view
- **Tap agent card** to go to detail page
- **Swipe table left** on leaderboard to see all columns
- **Use mobile filters** to simplify view

---

## 🚀 Future Enhancements (Coming Soon)

- **Iteration 4:** Achievement Tracker (locked/unlocked achievements)
- **Iteration 5:** Combo Notifications (toast when agents combo together)
- **Iteration 6:** WebSocket Real-time (live XP gains, level ups, mood changes)

---

## 📞 API Reference

These pages call these backend endpoints automatically:

| Page | Endpoints |
|------|-----------|
| Roster | `/api/agents/all` |
| Detail | `/api/agents/status/:name`, `/api/agents/:name/achievements` |
| Leaderboard | `/api/agents/leaderboard` |

All endpoints already exist in `server/routes/rpg-agents.ts` ✅

---

**Happy trading! 🚀**

