import { listClients, listProjects } from '@/lib/data/queries'
import { ClientsView } from '@/components/clients/ClientsView'
import { PageHead } from '@/components/shell/PageHead'
import { Problem } from '@/components/ui'

export default async function ClientsPage() {
  const [clients, projects] = await Promise.all([listClients(), listProjects()])

  return (
    <>
      <PageHead title="Clients" hint="The people you are designing for, and what you are building for them." />
      <div className="px-4 py-5 md:px-6">
        {!clients.ok ? (
          <Problem title="Clients could not be loaded" detail={clients.error} />
        ) : (
          <>
            {!projects.ok ? (
              <div className="mb-4">
                <Problem title="Project counts are missing" detail={projects.error} />
              </div>
            ) : null}
            <ClientsView clients={clients.data} projects={projects.ok ? projects.data : []} />
          </>
        )}
      </div>
    </>
  )
}
