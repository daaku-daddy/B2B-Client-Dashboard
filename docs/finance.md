# Project finances

**Covers:** `components/finance/** · projectPnl() · FINANCE_CATEGORIES`

## The ledger is entered by hand, on purpose

It would be easy to compute a P&L from the quote. It would also be wrong: what
a client was **quoted** and what they have **paid** are different facts, and a
margin derived from the quote would show a healthy profit on a project nobody
has paid for.

So `finance_entry` is a plain two-direction ledger — `cost` / `income`, each
with a category, a date, a counterparty and a `settled` flag — and `projectPnl()`
reports six figures from it:

| Figure | Meaning |
|---|---|
| `income` / `cost` | everything logged |
| `incomeSettled` / `costSettled` | the part that has actually moved |
| `receivable` | invoiced and not received |
| `payable` | owed out |

`profit` is `income − cost` (logged, not settled) and `marginPct` guards its
divide, so an empty project is 0%, never `NaN%`.

## The one shortcut, made explicit

When a quote is accepted and the ledger is still empty, the tab offers to seed
two entries: the client total as income, the Material Depot bill as cost, both
**unpaid**. It is a button with the numbers written on it, not something that
happens on its own.

If the first entry saves and the second fails, the error says exactly that —
"the client entry was added, but the material cost was not" — rather than
implying nothing happened. Two writes, two chances to fail, one honest message.

## Material committed

The "Material committed" tile sums `qty_ordered × rate` off the procurement
list, not the quote. It answers "how much material have I actually put on
order?", which is the number that turns into an invoice.
