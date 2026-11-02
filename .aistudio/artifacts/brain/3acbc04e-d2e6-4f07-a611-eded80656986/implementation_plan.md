# Hollow Strike - Valorant-Style Lobby Redesign, Mobile Control Overhaul & Vercel Deployment Plan

A comprehensive architectural plan to transform Hollow Strike's home screen into an authentic Valorant-style tactical lobby matching the provided reference image (`images__4__87cb3402.jpeg`), fix all mobile touch joystick inversion and sensitivity issues, enlarge touch hitboxes, and configure Vercel deployment support.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the following design choices in Phase 1:
> - **Lobby Style**: Full Valorant-style tactical lobby featuring party cards, agent banner artwork, queue mode selector, top nav bar, and party list sidebar.
> - **Mobile Controls**: Inverted Y-axis joystick fix, smoothed touch look swipe sensitivity, and enlarged touch button hitboxes ($\ge 52\text{px}$).
> - **Deployment Instructions**: Step-by-step Vercel guide paired with a root `vercel.json` SPA build configuration.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. Replaces the generic title screen with a production-grade **Valorant-style main lobby interface**:
     - **Top Nav Bar**: `BACK // PLAY` breadcrumb, centered view tabs (`PLAY`, `AGENTS`, `ARMORY`, `CAREER`), party size counter, currency counters, and settings gear.
     - **Center Stage**: 5 vertical party cards displaying active player banners, agent cards, level badges, and `+` slots for bot/party invites.
     - **Queue Selector**: Left-side panel for selecting game modes (`UNRATED`, `COMPETITIVE`, `PLANT / DEFUSE 5V5`, `PRACTICE`).
     - **Friends & Party Drawer**: Right-side tactical sidebar with player status indicators.
     - **Bottom Action Dock**: Prominent red `START` button flanked by `PRACTICE` and `LEAVE PARTY` controls.
  2. **Mobile Touch Control Fixes**:
     - Fixes joystick Y-axis inversion (pushing UP now moves forward $+1.0$, DOWN moves backward $-1.0$).
     - Smoothes touch-look swipe rotation with normalized touch delta accumulation.
     - Expands fire, ADS, jump, reload, and ability button hitboxes for comfortable thumbs-friendly play in landscape orientation.
  3. **Vercel Deployment**:
     - Provides a root `vercel.json` with SPA routing rules and build commands.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Lobby & Queue Selection Flow**:
   - User lands on the Valorant-style lobby page (`BACK // PLAY` header).
   - User can switch queue modes on the left panel (e.g. `PLANT / DEFUSE 5V5`).
   - User selects an Agent banner card on center stage (e.g. Zephyr, Blitz, Bastion, Lumen).
   - User clicks the prominent red **START** button (or presses `Space`/`Enter`) to launch into gameplay.

2. **Mobile Gameplay Flow**:
   - Player moves fluidly using the corrected left analog joystick (pushing UP moves forward, DOWN moves backward).
   - Player aims precisely using the right touch-swipe surface.
   - Enlarged, ergonomic action buttons allow immediate firing, reloading, jumping, and ability casts without accidental misses.

### Visual Identity & Theme

- **Palette**: Deep Obsidian (#080c14), Cobalt Steel (#1e293b), Tactical Crimson (#ef4444) for primary Start CTA, Electric Cyan (#06b6d4) for active highlights, and Gold (#f59e0b) for leader badges.
- **Typography**: Display/Headers in `Oswald` / `Barlow` style uppercase typography; Body & Tabular metrics in `JetBrains Mono` / tabular numerals.
- **Layout Math**: Desktop 1440px wide layout matching the reference mockup with symmetrical 5-card party stage and sticky bottom action bar.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Modularizing the Valorant Lobby**:
  - *Chosen Approach*: Create a dedicated `LobbyScreen.tsx` component that visually mirrors `images__4__87cb3402.jpeg` with sub-components for TopNav, QueueSelector, PartyStage, and FriendDrawer.
  - *Why*: Keeps `App.tsx` clean and decoupled while allowing rapid UI iteration.

- **Decision 2: Joystick Y-Axis Inversion Fix**:
  - *Chosen Approach*: Fix coordinate transformation in `src/game/inputManager.ts` and `src/components/MobileControls.tsx` where `normY` was negated twice. Standardize $stickY < 0$ (pushing up towards top of screen) as positive forward movement $+1.0$.

- **Decision 3: Vercel SPA Routing Configuration**:
  - *Chosen Approach*: Add `vercel.json` with static build outputs (`dist`) and wildcard rewrites to `index.html`.
  - *Why*: Guarantees single-page React app routes load without 404 errors upon refresh on Vercel edge nodes.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          VALORANT LOBBY SCREEN                              │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Top Nav: [BACK // PLAY] | Tabs (PLAY, ARMORY, AGENTS) | [Settings ⚙]    │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌───────────────┐  ┌─────────────────────────────────────┐  ┌─────────────┐ │
│ │ Queue Selector│  │ Center Party Stage (5 Banner Cards) │  │ Friends List│ │
│ │ - Unrated     │  │  [Card 1] [Card 2] [Card 3] [...]   │  │  - Online   │ │
│ │ - 5v5 Plant   │  └─────────────────────────────────────┘  └─────────────┘ │
│ └───────────────┘  ┌─────────────────────────────────────┐                  │
│                    │ Bottom Bar: [PRACTICE] [START] [LEAVE]│                  │
│                    └─────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │ (Clicks START)
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            THREE.JS GAME ENGINE                             │
│ ┌───────────────────────────┐           ┌─────────────────────────────────┐ │
│ │   Fixed Timestep Sim      │ ◄───────  │ Fixed Mobile Joystick (Up=Fwd) │ │
│ │   - Physics & Recoil      │           │ Right Swipe Look Surface        │ │
│ │   - Bot AI Pathfinding    │           │ Enlarged Action Buttons         │ │
│ └───────────────────────────┘           └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure Modifications

- `vercel.json`: Root build and SPA route configuration.
- `src/components/LobbyScreen.tsx`: New Valorant-style lobby matching the screenshot.
- `src/components/MobileControls.tsx`: Corrected joystick math and enlarged touch hitboxes.
- `src/game/inputManager.ts`: Direct non-inverted joystick transformation logic.
- `src/App.tsx`: State wiring to render `LobbyScreen` in place of old title screen.

---

## 5. Vercel Deployment Instructions

Once code updates are completed, deploy to Vercel following these steps:

1. **Prerequisite**: Ensure Node.js 18+ and `npm` are installed.
2. **Step 1 - Test Local Build**:
   ```bash
   npm run build
   ```
   Verify that the `dist/` directory compiles with zero TypeScript errors.
3. **Step 2 - Option A: Deploy via Vercel CLI**:
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```
   Follow the CLI prompts (accept default build command `npm run build` and output directory `dist`).
4. **Step 3 - Option B: Deploy via GitHub / Git Repository**:
   - Push your repository to GitHub.
   - Go to [vercel.com](https://vercel.com) and click **Add New Project**.
   - Import your GitHub repository.
   - Select **Vite** as the Framework Preset.
   - Click **Deploy**. Vercel will automatically read `vercel.json` and serve the applet globally.
