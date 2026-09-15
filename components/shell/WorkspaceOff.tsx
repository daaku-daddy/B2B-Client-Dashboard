import Link from 'next/link'
import { PageHead } from './PageHead'
import { Button, Card } from '@/components/ui'

/**
 * The project workspace is off for this firm.
 *
 * Rendered rather than redirected, for two reasons. A redirect makes a
 * bookmarked link look broken, and this is not an error — it is a module the
 * firm has not asked for yet. Saying so, and saying that nobody at Material
 * Depot can see inside it, is the sentence that gets it switched on.
 */
export function WorkspaceOff({ what }: { what: string }) {
  return (
    <>
      <PageHead title={what} hint="Not switched on for your studio yet" />
      <div className="px-4 py-5 md:px-6">
        <Card className="max-w-2xl p-5">
          <h2 className="font-display text-[15px] font-semibold tracking-tight text-ink">
            This part is off for your account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Design boards, client quotes with your own markup, a procurement list and a project P&amp;L are
            all built here. They are switched off by default because most studios want to see what their
            referred clients are doing first, and a portal full of modules nobody asked for is not much of
            a welcome.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Nothing you put in them is visible to Material Depot — not your clients, not your rates, not
            your margins. Tell your key account manager and we will turn it on.
          </p>
          <div className="mt-4 flex gap-2">
            <Link href="/dashboard"><Button variant="primary">Back to your overview</Button></Link>
            <Link href="/referrals"><Button>See your referred clients</Button></Link>
          </div>
        </Card>
      </div>
    </>
  )
}
