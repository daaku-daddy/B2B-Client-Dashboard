# About / Settings

**Covers:** `app/(app)/settings · components/settings/** · lib/domain/theme.ts ·
notification_pref` — PRD §13

Four tabs: Studio, Team & GST, Appearance, Notifications. Two of them are
deliberately read-only and saying so on screen is the point rather than a
shortcoming.

## The two things a firm cannot change itself

**Team** (§13.2). `partner_user` has no insert policy for a firm and should not
get one: a self-serve seat would be a login into Material Depot's systems that
Material Depot did not issue. So the tab explains what to ask for and who to ask
— which is more useful than a form that fails.

**GSTIN** (§13.1). Orders billed to a linked GST roll up into the parent for slab
computation, so a firm adding one would be adding to its own reward base. The
field is shown disabled rather than hidden: nobody benefits from not knowing what
we have on file.

`partner_guard_md_fields()` in `004_roles_rls.sql` is what actually stops both.

## Pincode

§2.5 requires pincode and city captured in **Phase 1** so that pincode-based KAM
assignment in Phase 2 is a configuration change and not a rebuild — without a
key, automatic assignment later has nothing to work on. It is format-validated
rather than free text, because a wrong pincode routes a firm to the wrong KAM
silently, which is the worst kind of wrong.

## Theme (§13.3)

Eight curated presets, or a custom primary and accent. `lib/domain/theme.ts`
enforces three of §13.3's four constraints:

**WCAG AA, rejected not auto-adjusted.** `checkTheme()` measures the real
contrast ratio against white and refuses anything under 4.5:1. The message
quotes the measurement — "1.31:1, and a button label needs 4.5:1" — because "too
light" on its own reads as a matter of taste rather than a standard. A custom
colour that fails is still **stored** (a partner's brand colour is their brand
colour) and not **applied**; the workspace falls back to the preset.

> Running the preset test for the first time found that this app's own shipped
> brand orange `#c4581c` measured **4.41:1** and failed. It is now `#bd5318`
> (4.76:1), which is indistinguishable side by side. Fixing our own colour was
> cheaper than exempting it from the rule we are about to enforce on partners'.

**Status colours are not themeable.** `cssVariables()` emits six names, all of
them brand tokens. Not ink, not surface, not line, and above all not
good/warn/bad. The list being short is the feature: it makes the rule a property
of the code rather than a promise in a document, and `test/domain.test.ts`
asserts the forbidden names never appear in the output.

**Core surfaces stay neutral.** Same mechanism — ground, surface and ink are not
in the list.

The theme is applied as a `style` attribute on the partner shell, not injected
into `<head>`: no flash of the default palette, and it is scoped so the staff
console can never pick up a firm's colours.

## Notifications (§13.4)

Six event classes × three channels. Two rules:

- **Transactional and legal notices are not on the list at all.** A greyed-out
  row a partner cannot switch off is an invitation to try; absence is the honest
  representation of something that is not a choice.
- **A missing row means everything is on.** A firm that has never opened this
  page should still be told its cashback was confirmed, so the default is
  opt-out — `?? true` in the component, not a migration that writes a row per
  firm.

Nothing sends notifications yet. `docs/open-questions.md` has the standing note
about there being no mail or WhatsApp transport on this deployment; these
preferences are the contract the sender will read.
