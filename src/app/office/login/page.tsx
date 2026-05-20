import OfficeLoginClient from './OfficeLoginClient'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

export default function OfficeLoginPage({ searchParams }: Props) {
  const err = typeof searchParams.error === 'string' ? searchParams.error : undefined
  const next = typeof searchParams.next === 'string' ? searchParams.next : undefined
  const pinAuth = process.env.OFFICE_PIN_AUTH_ENABLED === 'true'

  return <OfficeLoginClient pinAuthEnabled={pinAuth} error={err} nextPath={next} />
}
