import { requireStaff } from '@/lib/data/session'
import { listAllOrders, listPortfolioQueue } from '@/lib/data/console-queries'
import { ApprovalQueue } from '@/components/console/ApprovalQueue'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function ApprovalsPage() {
  const [staff, orders, portfolio] = await Promise.all([
    requireStaff(), listAllOrders(), listPortfolioQueue(),
  ])

  if (!staff.ok) {
    return (
      <>
        <PageHead title="Verify" />
        <div className="px-4 py-5 md:px-6"><Problem title="You cannot open this" detail={staff.error} /></div>
      </>
    )
  }

  return (
    <>
      <PageHead
        title="Verify"
        hint="An order counts towards a partner's rewards only once it has been checked here, and work goes on our site only once it has been read."
      />
      <div className="px-4 py-5 md:px-6">
        <ApprovalQueue
          orders={orders.ok ? orders.data : []}
          portfolio={portfolio.ok ? portfolio.data : []}
          canDecide={staff.data.role === 'admin'}
          ordersError={orders.ok ? null : orders.error}
          portfolioError={portfolio.ok ? null : portfolio.error}
        />
      </div>
    </>
  )
}
