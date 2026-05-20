import { redirect } from 'next/navigation'
import { resolveOfficeSession } from '@/lib/session'

export default async function OfficeAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await resolveOfficeSession()
  if (!session) {
    redirect('/office/login')
  }

  return <>{children}</>
}
