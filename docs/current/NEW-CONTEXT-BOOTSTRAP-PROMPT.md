# New Context Bootstrap Prompt

**Purpose:** Copy-paste this prompt to start a new Claude context window
**Last Updated:** 2026-02-16

---

## 📋 The Prompt

```
You are continuing work on the GIS 2026 World Cup Sweepstakes project.

Project: Next.js 14 + Firebase (Auth, Firestore, Cloud Functions) + TypeScript
Location: /Users/harrison.j/world-cup-sweepstakes-clean

CRITICAL - Read these documents immediately to understand the project:

1. /Users/harrison.j/world-cup-sweepstakes-clean/docs/current/NEW-CONTEXT-HANDOVER.md
   - Contains ALL non-negotiables: Git workflow, commit format, PR requirements
   - Current priorities and roadmap reference
   - Token optimization rules
   - Decision trees for common workflows

2. /Users/harrison.j/world-cup-sweepstakes-clean/docs/current/BUILD-STATUS-NEXT-STEPS.md
   - Current development roadmap
   - What's complete, what's next
   - Prioritized task list with ELI5 explanations

After reading these documents:
- Confirm you understand the non-negotiables (Git workflow, commit format with Co-Authored-By tag)
- Ask me what I'd like to work on today
- Reference the prioritized tasks from BUILD-STATUS-NEXT-STEPS.md
```

---

## 🎯 Why This Works

**Efficient:**
- 2 files contain everything needed
- No hunting through scattered docs
- Clear action items after reading

**Complete:**
- All workflows (Git, PR, commit)
- All non-negotiables (TypeScript rules, Firebase security)
- Current priorities (BUILD-STATUS-NEXT-STEPS)
- Token optimization guidelines

**Safe:**
- New context gets strict rules upfront
- Knows to ask before dangerous operations
- Understands Co-Authored-By requirement

---

## 📝 Alternative: Minimal Prompt

If you want an even shorter bootstrap:

```
Continue work on: /Users/harrison.j/world-cup-sweepstakes-clean

Read immediately:
1. docs/current/NEW-CONTEXT-HANDOVER.md (workflows & rules)
2. docs/current/BUILD-STATUS-NEXT-STEPS.md (current priorities)

Then ask me what to work on.
```

---

## ✅ Expected Response

After reading the documents, the new context should:

1. ✅ Confirm understanding of:
   - Git workflow (branch naming, commit format)
   - Co-Authored-By requirement in every commit
   - BUILD-STATUS-NEXT-STEPS as the roadmap

2. ✅ Reference top priorities:
   - Standalone leaderboard page
   - Complete squad details placeholders
   - Improve type safety

3. ✅ Ask: "What would you like to work on today?"

---

## 🔄 Maintenance

**Update this prompt when:**
- Major workflow changes (new commit requirements, etc.)
- Different roadmap document becomes primary
- New critical documents added to `/docs/current/`

**Current as of:** 2026-02-16
- Roadmap: BUILD-STATUS-NEXT-STEPS.md ✅
- Handover: NEW-CONTEXT-HANDOVER.md ✅
- Old docs archived ✅

---

## 📞 Troubleshooting

**If new context doesn't follow workflows:**
→ Point them to NEW-CONTEXT-HANDOVER.md section on non-negotiables

**If new context uses old docs:**
→ Remind them: "Current docs are in /docs/current/, archive is historical only"

**If new context asks about priorities:**
→ Direct them to BUILD-STATUS-NEXT-STEPS.md

---

**Copy the prompt above to start any new Claude session! 🚀**
