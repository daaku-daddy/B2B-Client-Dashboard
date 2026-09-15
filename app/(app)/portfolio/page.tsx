import { currentSession } from '@/lib/data/session'
import { listPortfolio } from '@/lib/data/queries'
import { PortfolioView } from '@/components/portfolio/PortfolioView'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function PortfolioPage() {
  const [session, items] = await Promise.all([currentSession(), listPortfolio()])

  if (!session.ok || !session.data) {
    return (
      <>
        <PageHead title="Portfolio" />
        <div className="px-4 py-5 md:px-6">
          <Problem
            title="Your studio could not be loaded"
            detail={session.ok ? 'This login is not attached to a firm.' : session.error}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Portfolio"
        hint="We put our partners’ work on materialdepot.com. Add a project, send it to us, and we publish it with a link back to you."
      />
      <div className="px-4 py-5 md:px-6">
        {!items.ok ? (
          <Problem title="Your portfolio could not be loaded" detail={items.error} />
        ) : (
          <PortfolioView partner={session.data.partner} items={items.data} />
        )}
      </div>
    </>
  )
}
