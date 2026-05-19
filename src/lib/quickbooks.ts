import QuickBooks from 'node-quickbooks'
import { supabaseAdmin } from './supabase'

/**
 * QuickBooks Direct Integration
 * Handles OAuth token refresh and Draft Invoice creation.
 */

async function getQBConfig() {
  const { data: config } = await supabaseAdmin
    .from('config')
    .select('*')
    .eq('key', 'quickbooks_auth')
    .single()
  return config?.value || {}
}

interface QBConfig {
  accessToken?: string
  realmId?: string
  clientId?: string
  clientSecret?: string
  refreshToken?: string
  expiresAt?: number
}

export { getQBConfig }
export type { QBConfig }

/**
 * Map skip size and job type to QuickBooks ItemRef.
 * These values should be configured in QB Settings > Products & Services.
 */
function getItemRef(skipSize: string, jobType?: string): { name: string; value: string } {
  // Map skip sizes to QB Item IDs -- these should be set in your QB account
  const skipItemMap: Record<string, string> = {
    '4': 'SH-4',
    '6': 'SH-6',
    '8': 'SH-8',
    '10': 'SH-10',
    '12': 'SH-12',
    '14': 'SH-14',
    '16': 'SH-16',
    'E14': 'SH-E14',
    'E16': 'SH-E16',
    '20': 'SH-20',
    '25': 'SH-25',
    '40': 'SH-40',
    'Cage': 'SH-CAGE',
  }

  const itemId = skipItemMap[skipSize] || 'SH-GENERAL'
  const itemName = jobType ? `${jobType} - ${skipSize}yd` : `Skip Hire - ${skipSize}yd`

  return { name: itemName, value: itemId }
}

/**
 * Refresh the QuickBooks access token using the stored refresh token.
 * Updates the tokens in the config table.
 */
export async function refreshQBToken(): Promise<string> {
  const config = await getQBConfig() as QBConfig
  if (!config.clientId || !config.clientSecret) throw new Error('QB not configured')
  const { clientId, clientSecret, refreshToken } = config

  if (!refreshToken) {
    throw new Error('No refresh token available. Please reconnect QuickBooks.')
  }

  // Use QuickBooks OAuth token refresh endpoint
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const tokenEndpoint = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const tokenData = await response.json()

  // Update stored tokens
  await supabaseAdmin.from('config').upsert({
    key: 'quickbooks_auth',
    value: {
      ...config,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || refreshToken, // QB may return a new refresh token
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
    },
    updated_at: new Date().toISOString(),
  })

  return tokenData.access_token
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getValidAccessToken(): Promise<string> {
  const config = await getQBConfig() as QBConfig
  if (!config.clientId || !config.clientSecret) throw new Error('QB not configured')

  // If token is expired or about to expire (within 5 minutes), refresh it
  const expiresAt = config.expiresAt || 0
  if (!config.accessToken || Date.now() > expiresAt - 5 * 60 * 1000) {
    return refreshQBToken()
  }

  return config.accessToken
}

export async function createDraftInvoice(order: {
  customer_name: string,
  address: string,
  skip_size: string,
  skip_id?: string,
  date: string,
  id: string,
  amount: number,
  job_type?: string,  // ADD -- to map to correct QB Item
}) {
  const accessToken = await getValidAccessToken()
  const config = await getQBConfig() as QBConfig
  if (!config.clientId || !config.clientSecret) throw new Error('QB not configured')
  const realmId = config.realmId ?? ''
  const clientId = config.clientId ?? ''
  const clientSecret = config.clientSecret ?? ''
  const refreshToken = config.refreshToken

  if (!accessToken || !realmId) {
    throw new Error('QuickBooks not connected. Please connect in settings.')
  }

  const isSandbox = process.env.QB_SANDBOX === 'true'
  const qbo = new QuickBooks(
    clientId,
    clientSecret,
    accessToken,
    false,
    realmId,
    isSandbox, // Use env var -- defaults to false (production)
    true,
    null,
    '2.0',
    refreshToken
  )

  // Map skip size and job_type to QB ItemRef
  const itemRef = getItemRef(order.skip_size, order.job_type)

  return new Promise((resolve, reject) => {
    // 1. Find or Create Customer
    qbo.findCustomers({ DisplayName: order.customer_name }, (err: unknown, customers: unknown) => {
      if (err) return reject(err)

      const custs = customers as Record<string, unknown>
      let customerId = (custs?.QueryResponse as Record<string, unknown>)?.Customer as unknown as Array<{Id?: string}>
      let customerIdStr = customerId?.[0]?.Id

      const proceedWithInvoice = (cId: string) => {
        const invoiceData = {
          Line: [
            {
              DetailType: 'SalesItemLineDetail',
              Amount: order.amount,
              Description: `Skip Size: ${order.skip_size}yd | Address: ${order.address} | ID: ${order.skip_id || 'N/A'}`,
              SalesItemLineDetail: {
                ItemRef: itemRef
              }
            }
          ],
          CustomerRef: {
            value: cId
          },
          DocNumber: `ENV-${order.id.substring(0, 8)}`,
          TxnDate: order.date
        }

        qbo.createInvoice(invoiceData, (invErr: unknown, invoice: unknown) => {
          if (invErr) return reject(invErr)
          resolve(invoice)
        })
      }

      if (!customerId) {
        qbo.createCustomer({ DisplayName: order.customer_name }, (cErr: unknown, customer: unknown) => {
          if (cErr) return reject(cErr)
          proceedWithInvoice((customer as Record<string, unknown>)?.Id as string ?? '')
        })
      } else {
        proceedWithInvoice(customerIdStr ?? '')
      }
    })
  })
}
