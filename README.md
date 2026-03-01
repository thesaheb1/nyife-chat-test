# Nyife — Claude Code Setup Kit

## 📁 What's in this kit

| File | Purpose |
|---|---|
| `CLAUDE.md` | **THE BRAIN** — Place in project root. Claude Code auto-reads it. Contains architecture, conventions, rules, phase plan. |
| `STRATEGY.md` | For YOU — How to use this system effectively, context management, troubleshooting. |
| `WHATOMATE_EXTRACTION_GUIDE.md` | For YOU — How to extract useful patterns from whatomate WITHOUT burning context. |
| `phase-prompts/phase-1.md` | Foundation: scaffold, shared libs, API gateway, Docker |
| `phase-prompts/phase-2.md` | Auth, User, Organization services |
| `phase-prompts/phase-3.md` | Subscription, Wallet services |
| `phase-prompts/phase-4.md` | WhatsApp, Contact, Template, Media services |
| `phase-prompts/phase-5.md` | Campaign, Chat services |
| `phase-prompts/phase-6.md` | Automation, Notification, Email services |
| `phase-prompts/phase-7.md` | Admin, Support, Analytics services |
| `phase-prompts/phase-8.md` | Frontend: User Dashboard (React) |
| `phase-prompts/phase-9.md` | Frontend: Admin Dashboard (React) |
| `phase-prompts/phase-10.md` | Testing, Optimization, Deployment |

## 🚀 Quick Start

### Step 1: Prepare
```bash
# Create project
mkdir nyife && cd nyife
git init

# Copy CLAUDE.md to root
cp /path/to/this-kit/CLAUDE.md ./CLAUDE.md

# Create reference docs (from whatomate extraction)
mkdir -p docs/whatsapp-reference
# Follow WHATOMATE_EXTRACTION_GUIDE.md to extract patterns
```

### Step 2: Extract from Whatomate (Optional but Recommended)
Follow `WHATOMATE_EXTRACTION_GUIDE.md` to create:
- `docs/whatsapp-reference/meta-api-patterns.md`
- `docs/whatsapp-reference/template-structures.md`
- `docs/whatsapp-reference/webhook-events.md`
- `docs/whatsapp-reference/business-logic.md`

### Step 3: Open Claude Code
```bash
claude  # Start Claude Code in the nyife directory
```
Claude Code will auto-read `CLAUDE.md`.

### Step 4: Execute Phase 1
Copy the contents of `phase-prompts/phase-1.md` and paste into Claude Code.
Wait for completion. Test. Commit.

### Step 5: Repeat
Continue with Phase 2, 3, 4... etc.
Always commit between phases.
If context degrades, start a new session.

## ⚠️ Important Tips

1. **One phase at a time** — Never paste multiple phases
2. **Commit between phases** — Git is your safety net
3. **Test before moving on** — Ensure services start and connect
4. **Split large phases** — Phase 4 and 8 can be split by service/module
5. **Don't feed whatomate raw code** — Extract patterns only per the guide
6. **New session if quality drops** — CLAUDE.md will reload automatically
7. **Read generated code** — Don't blindly accept everything
