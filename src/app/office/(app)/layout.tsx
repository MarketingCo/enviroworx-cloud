import { redirect } from 'next/navigation'
import { getSessionFromCookies } from '@/lib/session'

export default async function OfficeAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionFromCookies()
  if (!session || !['office', 'driver', 'yard'].includes(session.role)) {
    redirect('/office/login')
  }

  return <>{children}</>
}
