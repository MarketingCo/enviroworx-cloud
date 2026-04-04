import twilio from 'twilio'

export async function sendSms(to: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (!sid || !token || !from) {
    console.warn('Twilio credentials missing. SMS not sent.')
    return { success: false, error: 'Credentials missing' }
  }

  try {
    const client = twilio(sid, token)
    const res = await client.messages.create({
      body: message,
      from,
      to: to.startsWith('+') ? to : `+44${to.replace(/^0/, '')}` // Default to UK
    })
    return { success: true, sid: res.sid }
  } catch (error: any) {
    console.error('Twilio SMS Error:', error)
    return { success: false, error: error.message }
  }
}
