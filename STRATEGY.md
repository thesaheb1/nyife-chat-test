# Nyife — Claude Code (Opus 4.6) Execution Strategy

## How This System Works

### The Problem
Building a 17+ microservice SaaS app is too large for any AI to hold in context at once. If you dump everything in one prompt, Claude will:
- Hallucinate connections between services
- Create placeholder/stub code instead of real implementations
- Lose track of database schemas across services
- Mix up which service owns which responsibility

### The Solution: Phased Execution with Persistent Context

```
CLAUDE.md (always in context — it's auto-read by Claude Code)
    ↓
Phase Prompt (you paste one phase at a time)
    ↓
Claude Code reads existing code → builds on it → completes phase
    ↓
You verify → commit → move to next phase
```

## Setup Steps

### Step 1: Initialize Project
```bash
mkdir nyife && cd nyife
# Copy CLAUDE.md to project root
cp CLAUDE.md ./CLAUDE.md
# Copy pre-built WhatsApp API reference docs (already extracted from Meta Postman collections + whatomate)
mkdir -p docs/whatsapp-reference
cp docs/whatsapp-reference/meta-api-patterns.md ./docs/whatsapp-reference/
cp docs/whatsapp-reference/webhook-events.md ./docs/whatsapp-reference/
cp docs/whatsapp-reference/business-logic.md ./docs/whatsapp-reference/
git init && git add . && git commit -m "Initial project setup with CLAUDE.md and API reference docs"
```

### Step 2: Start Claude Code
```bash
claude   # or however you launch Claude Code
```
Claude Code auto-reads CLAUDE.md from project root.

### Step 3: Execute Phase 1
Copy-paste the Phase 1 prompt from `phase-prompts/phase-1.md` into Claude Code.
Wait for completion. Review code. Run it. Fix issues. Commit.

### Step 4: Repeat for Each Phase
Each phase prompt is self-contained and references CLAUDE.md for architecture rules.

## Critical Rules for You (the Developer)

### Between Phases:
1. **Always commit** completed phase code before starting next phase
2. **Always test** that services start and connect to DB/Redis/Kafka
3. **Run migrations** and verify tables are created correctly
4. **Review generated code** — don't blindly accept. Check:
   - Are Zod validations complete?
   - Are error handlers proper?
   - Are Kafka producers/consumers connected?
   - Are RBAC checks on every route?

### If Claude Code Loses Context:
If responses start degrading (stubs, placeholders, repeated mistakes):
1. Start a new Claude Code session (fresh context)
2. CLAUDE.md will auto-load again
3. Tell Claude: "Read the existing codebase in services/ and shared/ to understand current state, then continue with Phase X"
4. Paste the phase prompt again

### If a Phase Is Too Large:
Split it. For example, Phase 4 (WhatsApp Core) has 4 services. You can do:
- "Complete only the whatsapp-service from Phase 4"
- Then: "Complete only the contact-service from Phase 4"
- Etc.

## Context Budget Strategy

| Element | Approx Tokens | Always Loaded? |
|---|---|---|
| CLAUDE.md | ~4,000 | Yes (auto) |
| Phase prompt | ~2,000-3,000 | Yes (you paste it) |
| Current service code being edited | ~5,000-15,000 | Yes (Claude reads files) |
| Shared libraries | ~3,000-5,000 | As needed |
| WhatsApp reference doc (1 at a time) | ~2,000-4,000 | Phase 4+ only, per service |
| **Total active context** | **~15,000-30,000** | Leaves plenty of room |

vs. if you loaded whatomate: +100,000-200,000 tokens = context destroyed.

> **Note:** The 3 reference docs in `docs/whatsapp-reference/` total ~1,500 lines but Claude Code only reads the one relevant to the current service (not all 3 at once). CLAUDE.md tells it which file to read for which service.

## Phase Overview

| Phase | Services Built | Depends On |
|---|---|---|
| 1 - Foundation | Scaffold, shared libs, gateway, docker | Nothing |
| 2 - Auth & Users | auth, user, organization | Phase 1 |
| 3 - Subscription & Finance | subscription, wallet | Phase 2 |
| 4 - WhatsApp Core | whatsapp, contact, template, media | Phase 2 |
| 5 - Campaigns & Chat | campaign, chat | Phase 3, 4 |
| 6 - Automation & Comms | automation, notification, email | Phase 4, 5 |
| 7 - Admin Backend | admin, support, analytics | Phase 2, 3 |
| 8 - Frontend: User | React user dashboard | Phase 2-6 |
| 9 - Frontend: Admin | React admin dashboard | Phase 7 |
| 10 - Polish | Tests, optimization, deployment | All |

## Estimated Timeline

With Claude Code working efficiently:
- Phase 1: 1-2 sessions (~2-4 hours)
- Phase 2: 2-3 sessions (~4-6 hours)
- Phase 3: 1-2 sessions (~2-4 hours)
- Phase 4: 3-4 sessions (~6-8 hours) — most complex
- Phase 5: 2-3 sessions (~4-6 hours)
- Phase 6: 2-3 sessions (~4-6 hours)
- Phase 7: 2-3 sessions (~4-6 hours)
- Phase 8: 4-6 sessions (~8-12 hours) — lots of UI
- Phase 9: 3-4 sessions (~6-8 hours)
- Phase 10: 2-3 sessions (~4-6 hours)

**Total: ~25-35 sessions, ~50-70 hours of Claude Code work**

This is a large project. Don't rush. Quality > speed.
