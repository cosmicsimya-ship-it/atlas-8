# ATLAS Figma Visual Elevation — Audit Pack

**File:** https://www.figma.com/design/My9bM1AAZvK2olCTIan4il  
**Date:** 2026-07-31  
**Scope:** Visual perfection of existing screens — no new product architecture  
**Target identity:** Living digital intelligence (ice / steel / cyan on void) — not dashboard, chatbot, or website chrome

---

## 1. Design Audit

### File structure
| Page | Content |
|------|---------|
| ◈ ATLAS / Foundations | Cover, Color, Type, Spacing docs + 11 component sets |
| ◈ ATLAS / Marketing | Landing, Login, Register, Pricing, Membership × Desktop/Tablet/Mobile |
| ◈ ATLAS / Product | Dashboard, Chat, Daily/Symbolic Analysis, Profile, Settings, Admin × D/T/M |

### Tokens present
- Primitives 31 · Color/Dark 21 · Spacing 9 · Radius 5  
- Text styles 12 · Effect styles 3 (`Elevation/Soft`, `Elevation/Glass`, **`Glow/Gold`**)

### What works
- Syne + Manrope pairing on most UI  
- Dark void base language  
- Component-set coverage (Button, Input, GlassCard, ChatBubble, etc.)  
- Responsive frame matrix (Desktop / Tablet / Mobile)  
- Product shell rhythm (Sidebar gap 8, Main pad 32/40) is mostly consistent

### What breaks the living-intelligence feel
1. **Gold brand fill** on ATLAS marks (~`#C9A227`) → mystic / luxury, not instrument  
2. **Cormorant Garamond** hero display → editorial / spiritual landing  
3. **Violet + gold GlassCard variants** + `Glow/Gold` → fantasy SaaS  
4. **Pricing / Membership** screens read as generic SaaS plan tables  
5. **Product shell** still dashboard-coded (sidebar nav density, “Dashboard” as home metaphor)  
6. **Chat** uses SMS-like bubbles + English “You” meta — thin messenger, not presence  
7. **Button radius 12** everywhere — primary should feel distinct (pill / clearer hierarchy)  
8. Many **primitive variables have empty scopes** → weak design-system discipline  
9. Landing nav / sections still **website IA** (Nedir / Analiz / Üyelik)

---

## 2. Inconsistency Report

| Area | Inconsistency | Severity |
|------|---------------|----------|
| Brand color | Gold on marks vs ice body text | Critical |
| Display type | Cormorant on Landing hero; Syne elsewhere | Critical |
| Accent system | Gold + violet primitives vs ice/steel/cyan product direction | Critical |
| Effects | `Glow/Gold` only branded glow | High |
| GlassCard | Variants `Violet` / `Gold` vs calm glass | High |
| Radius | Buttons 12; DS wants md 14 + primary pill | Medium |
| Spacing | Marketing hero breathing ≠ Product main pad | Medium |
| Language | TR UI + EN helper (“We never share…”, “You”) | Medium |
| Elevation | Soft vs Glass used inconsistently on cards | Medium |
| Responsive | Landing Mobile height/content density uneven vs Desktop | Medium |
| SaaS patterns | Pricing cards, plan tiers, membership upsell chrome | High |
| Chat identity | Bubble chrome identical weight both sides | Medium |

---

## 3. Component Review

| Component | Status | Action |
|-----------|--------|--------|
| Button (36) | Strong structure | Recolor accents; Primary → ice fill + pill radius; kill gold hover |
| Input (5) | Good states | Focus ring → cyan/steel, not gold |
| GlassCard (4) | Contaminated | Retarget Violet→Steel, Gold→Seam/Elevated ice |
| NavItem (3) | OK | Active indicator → cyan pulse, not gold |
| ChatBubble (2) | Generic | Atlas softer/wider; User denser; meta TR |
| PricingCard (3) | SaaS | Restyle to quiet glass tiers; featured = steel seam, not gold |
| Toggle / Avatar / Badge / Tab | OK | Badge gold→steel/cyan semantic |
| AdminTableRow | Ops OK | Keep denser; align border to steel hairline |

---

## 4. Design System Improvements

### Color (align to ATLAS DS v0.2)
| Do | Don't |
|----|-------|
| void / space / midnight | Gold fills as brand |
| ice `#E8ECF2` for marks & primary text | Cormorant as product display |
| steel `#7A92B0` structure | Violet washes |
| cyan `#8EEAFA` life / focus / seam | Glow/Gold |
| electric sparingly for Interact signal | Rainbow badges |

### Type
- Display/Hero → **Syne SemiBold/Bold** (retire Cormorant on product surfaces)  
- Keep Body/Label/Mono as-is; tighten tracking on Display (−0.02 to −0.03)

### Effects
- Rename / replace `Glow/Gold` → **`Glow/Cyan`** (low alpha cyan outer)  
- Keep Elevation/Soft + Elevation/Glass; prefer Glass on floating panels

### Spacing / Radius
- Enforce 4/8/12/16/24/32/48  
- Radius: controls 10–14 · panels 20 · primary CTA pill

### Glass
- Fill opacity ~3.5–6% white  
- Cool steel hairline  
- No opaque white nav fills

---

## 5. Visual Refinement Plan (execute in Figma)

**P0 — Foundations (tokens + components)**  
1. Remap gold primitives → steel / cyan / ice  
2. Remap violet → midnight / navy  
3. Replace `Glow/Gold` with `Glow/Cyan`  
4. Restyle GlassCard + PricingCard + Badge accents  
5. Button Primary radius → pill; focus/hover → cyan whisper  

**P1 — Marketing polish**  
6. All ATLAS marks gold → ice  
7. Landing hero display → Syne; improve type hierarchy  
8. Pricing featured tier gold → steel seam  
9. Login helpers → Turkish / quieter  

**P2 — Product polish**  
10. Brand marks ice across shell  
11. Chat meta TR; soften Atlas bubble  
12. Unify Main padding / card gaps to spacing scale  
13. Active NavItem → cyan indicator  

**Out of scope (no redesign):** New screens, IA changes, removing Pricing page existence, inventing Register Core illustration this pass.

---

## Gate
Implement P0→P2 in Figma only. Verify via screenshots after token + key screen passes.

---

## 6. Implementation log (executed in Figma)

**File:** https://www.figma.com/design/My9bM1AAZvK2olCTIan4il

### Done
| Item | Result |
|------|--------|
| `Glow/Gold` → `Glow/Cyan` | Cyan outer glow (a≈0.22) |
| gold/* primitives | → `steel/500`, `cyan/400`, `cyan/300` |
| violet/* primitives | → `midnight/800`, `navy-deep/600`, `electric/500` |
| Semantic accents | `color/accent/steel`, `/cyan`, `/electric`; `color/bg/midnight-wash` |
| GlassCard variants | Violet→Steel, Gold→Seam |
| Button Primary | Pill radius (999) on all Primary sizes/states |
| PricingCard accents | Gold fills/strokes → steel/cyan |
| Display/Hero style | Cormorant → **Syne Bold** |
| Landing hero instances | Cormorant → Syne (D/T/M) |
| Login helper | “We never share…” → “E-postan gizli kalır” |
| Marketing ATLAS marks | Forced **ice** `#E8ECF2` |
| Product ATLAS marks | Forced ice across D/T/M shells |
| Chat meta | “You” → “Sen” |

### Still open (next polish pass — no redesign)
- Full sidebar IA still reads dashboard-heavy (architecture kept by request)
- Pricing / Membership pages still exist as SaaS surfaces — visually calmed, not removed
- Chat bubbles still messenger-shaped — softer Atlas treatment partial; deeper Register presence later
- Input focus rings may still need instance-level cyan pass where unbound
- Primitive variable scopes still sparse on non-remapped tokens
- Admin + analysis screens: secondary gold leftovers if any unbound fills remain

### Principle check
| Question | After this pass |
|----------|-----------------|
| Same product language? | Stronger — ice/steel/cyan unified |
| Gold mystic removed? | Yes at token + brand mark level |
| Generic SaaS reduced? | Partially — pricing chrome quieter, not deleted |
| Living intelligence feel? | Improved; shell IA still product-next |
