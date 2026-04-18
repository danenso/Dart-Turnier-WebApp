# Dart Turnier WebApp – Development Cache

> **Compressed documentation and code navigation system for AI models (Sonnet, Opus, etc.)**

This directory contains optimized reference files to help future AI sessions quickly understand the entire codebase.

---

## 📋 Quick Start (What to Read First)

1. **New to the project?** → Start with [`app-cache.md`](./app-cache.md) (complete overview)
2. **Understanding Phase 6 & 7?** → Read [`PHASES_6_7_SUMMARY.md`](./PHASES_6_7_SUMMARY.md)
3. **Need specific code patterns?** → Check [`CODE_SNIPPETS.md`](./CODE_SNIPPETS.md)
4. **System architecture?** → See [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 📁 File Manifest

| File | Purpose | Audience | Read Time |
|------|---------|----------|-----------|
| **app-cache.md** | Complete system overview: collections, components, files, algorithms | All | 10 min |
| **PHASES_6_7_SUMMARY.md** | Detailed Phase 6 & 7 implementation: achievements, trophy showcase, hat-trick, iron-man | Implementers | 15 min |
| **ARCHITECTURE.md** | System design: layers, data flow, component hierarchy, error handling | Architects | 8 min |
| **CODE_SNIPPETS.md** | Copy-paste code patterns: queries, functions, UI components | Developers | Reference |
| **README.md** | This file: navigation & orientation | Everyone | 2 min |

---

## 🎯 Common Tasks

### "I need to add a new achievement"
1. Read: `PHASES_6_7_SUMMARY.md` → "11 Achievements Defined" section
2. Open: `lib/achievementEngine.ts`
3. Add to: `LEAGUE_ACHIEVEMENTS` array
4. Add grant logic: Update `grantXxx()` function
5. Reference: `CODE_SNIPPETS.md` → "Achievement Operations"

### "How do I display achievements on a player profile?"
1. Read: `ARCHITECTURE.md` → "Component Hierarchy"
2. Reference: `CODE_SNIPPETS.md` → "UI Components"
3. Example: `components/player/TrophyShowcase.tsx`
4. Integration: `app/players/[id]/page.tsx` line 145–147

### "I need to understand the tournament lifecycle"
1. Read: `ARCHITECTURE.md` → "Data Flow" section
2. Read: `app-cache.md` → "Key Functions & Algorithms"
3. Reference: `CODE_SNIPPETS.md` → "Tournament Lifecycle"

### "How does the Firestore schema work?"
1. Start: `app-cache.md` → "Data Model Overview"
2. Detailed rules: `ARCHITECTURE.md` → "Firestore Collections Map"
3. Validation: `firestore.rules` (in repo root)

### "I want to fix the Hat-Trick detection"
1. Read: `PHASES_6_7_SUMMARY.md` → "Hat-Trick Detection"
2. Read: `ARCHITECTURE.md` → "Key Algorithms" → "Hat-Trick Detection"
3. Code: `lib/achievementEngine.ts` line ~193–219

---

## 🔍 Navigation by Type

### Files & Components
- **All components**: `app-cache.md` → Section 3 "Key Components"
- **All pages**: `app-cache.md` → Section 3 "Pages (Routes)"
- **All libraries**: `app-cache.md` → Section 3 "Core Systems"

### Algorithms & Logic
- **Achievement granting**: `PHASES_6_7_SUMMARY.md` → "Key Additions"
- **Hat-Trick detection**: `ARCHITECTURE.md` → "Key Algorithms"
- **Iron-Man detection**: `ARCHITECTURE.md` → "Key Algorithms"
- **Retroactive points**: `PHASES_6_7_SUMMARY.md` → "Points Calculation"
- **Bracket generation**: `app-cache.md` → Section 8 "Bracket Generation"

### Data & Schema
- **Firestore schema**: `app-cache.md` → Section 2 "Data Model Overview"
- **Achievement storage**: `ARCHITECTURE.md` → "Achievement Storage & Retrieval"
- **Tournament lifecycle**: `ARCHITECTURE.md` → "Data Flow"

### Code Patterns
- **Querying players**: `CODE_SNIPPETS.md` → "Firestore Queries"
- **Updating achievements**: `CODE_SNIPPETS.md` → "Achievement Operations"
- **Error handling**: `CODE_SNIPPETS.md` → "Error Handling Patterns"
- **Performance tips**: `CODE_SNIPPETS.md` → "Performance Tips"

---

## 📊 Codebase at a Glance

```
Total TypeScript: ~14,790 lines
├─ lib/           ~2,500 lines (business logic)
├─ components/    ~3,000 lines (UI)
├─ app/           ~8,000 lines (pages)
└─ other/         ~1,290 lines (config, utils)

Achievement Engine (NEW):
├─ lib/achievementEngine.ts      345 lines
├─ components/player/TrophyShowcase.tsx    91 lines
└─ Integrated into 5 pages/components
```

---

## 🔑 Key Concepts at a Glance

| Concept | Definition | Location |
|---------|-----------|----------|
| **EarnedAchievement** | `{id, earnedAt, context}` stored in player doc | `lib/achievementEngine.ts` |
| **LeagueAchievementDef** | Achievement definition: name, icon, tier, stackable | `lib/achievementEngine.ts` |
| **Hat-Trick** | 3 consecutive matchday wins in same season (non-stackable) | `lib/achievementEngine.ts` line ~193 |
| **Iron Man** | Participated in all regular tournaments in season | `lib/achievementEngine.ts` line ~337 |
| **Retroactive Mode** | Two ways to enter old tournament results: matches-only or placements-only | `app/tournament/[id]/page.tsx` |
| **Grand Final** | End-of-season tournament with configurable bracket formats | `app/tournaments/page.tsx` + `tournament/[id]/page.tsx` |
| **Qualifier** | Top-8 (configurable) players from season standings | `app/standings/page.tsx` |

---

## 🚀 Deployment Checklist

Before pushing code:

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Deploy Firestore rules (if changed)
firebase deploy --only firestore:rules

# Deploy to Firebase Hosting (if needed)
firebase deploy
```

---

## 📈 Phase Completion Status

| Phase | Feature | Status | Files |
|-------|---------|--------|-------|
| **2** | Draw, Anwurf, Tiebreak | ✅ Complete | `TiebreakManager.tsx` |
| **3** | Settings, Boards, Templates | ✅ Complete | `app/settings/page.tsx` |
| **4** | Bug-Fixes, Retroaktive Matches | ✅ Complete | `app/tournament/[id]/page.tsx` |
| **5** | Grand Final Config | ✅ Complete | `firestore.rules`, Tournament schema |
| **6** | Achievement Engine | ✅ Complete | `lib/achievementEngine.ts` (345 lines) |
| **7** | Placements-only, Trophy, Hat-Trick, Iron-Man | ✅ Complete | `TrophyShowcase.tsx`, `saveRetroPlacements()` |

**Total Implementation**: 100% ✅

---

## 🔗 Important File References

### Production Code (most-edited files)
- `app/tournament/[id]/page.tsx` — Tournament management + retroactive modes
- `app/standings/page.tsx` — Standings, qualifiers, achievement grant button
- `lib/achievementEngine.ts` — All achievement logic
- `components/player/TrophyShowcase.tsx` — Trophy display
- `firestore.rules` — Data validation + security

### Supporting Files
- `lib/playerStats.ts` — Player statistics + re-exports
- `lib/match-rules.ts` — Scoring logic
- `components/player/PlayerAchievements.tsx` — Achievement tabs
- `app/players/[id]/page.tsx` — Player profile

### Configuration
- `firebase.json` — Firebase deployment config
- `firestore.rules` — Database security & validation
- `tsconfig.json` — TypeScript configuration
- `.eslintrc.json` — Linting rules

---

## 💡 Development Tips

### Adding a New Feature
1. Update relevant sections in `app-cache.md` after completion
2. If it's a new algorithm, add explanation to `ARCHITECTURE.md`
3. Add code snippets to `CODE_SNIPPETS.md` if reusable
4. Update `PHASES_6_7_SUMMARY.md` if relevant to existing phases

### Debugging Achievement Issues
1. Check `CODE_SNIPPETS.md` → "Debugging Helpers"
2. Verify Firestore rules in `firestore.rules` → `isValidGlobalPlayer()`
3. Test: Does player doc have `earnedAchievements` array?
4. Check: Is achievement definition in `LEAGUE_ACHIEVEMENTS`?

### Performance Issues
1. Reference: `CODE_SNIPPETS.md` → "Performance Tips"
2. Check: Are queries batched or N+1?
3. Check: Is player data cached in useState?
4. Review: `ARCHITECTURE.md` → "Performance Considerations"

---

## 📝 Last Updated

- **Date**: 2026-04-18
- **Model**: Sonnet 4.6 (Phase 6), Opus 4.6 (Phase 7)
- **Status**: Production Ready ✅
- **Lines of Code**: 14,790 TypeScript

---

## 🎓 For New AI Sessions

Start here in order:
1. **Read this file** (you are here) — 2 min orientation
2. **Skim `app-cache.md`** — 10 min high-level overview
3. **Read `PHASES_6_7_SUMMARY.md`** if working on achievements — 15 min
4. **Use `CODE_SNIPPETS.md`** while implementing — reference as needed
5. **Refer to `ARCHITECTURE.md`** for system design questions — reference as needed

Total: ~27 minutes for full understanding, or targeted reading for specific tasks.

---

**Questions? Check the relevant section above, then read the corresponding file.** 🚀
