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

export async function createDraftInvoice(order: {
  customer_name: string,
  address: string,
  skip_size: string,
  skip_id?: string,
  date: string,
  id: string,
  amount: number
}) {
  const config = await getQBConfig() as any
  const clientId = process.env.QUICKBOOKS_CLIENT_ID || config.clientId
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET || config.clientSecret
  const { accessToken, realmId, refreshToken } = config

  if (!accessToken || !realmId) {
    throw new Error('QuickBooks not connected. Please connect in settings.')
  }

  const qbo = new QuickBooks(
    clientId,
    clientSecret,
    accessToken,
    false,
    realmId,
    process.env.QUICKBOOKS_ENVIRONMENT === 'sandbox', // Use env var to toggle sandbox
    true,
    null,
    '2.0',
    refreshToken
  )

  return new Promise((resolve, reject) => {
    // 1. Find or Create Customer
    qbo.findCustomers({ DisplayName: order.customer_name }, (err: any, customers: any) => {
      if (err) return reject(err)

      let customerId = customers?.QueryResponse?.Customer?.[0]?.Id

      const proceedWithInvoice = (cId: string) => {
        const invoiceData = {
          Line: [
            {
              DetailType: 'SalesItemLineDetail',
              Amount: order.amount,
              Description: `Skip Size: ${order.skip_size}yd | Address: ${order.address} | ID: ${order.skip_id || 'N/A'}`,
              SalesItemLineDetail: {
                ItemRef: {
                  name: 'Skip Hire',
                  value: 'SH-1' // You should map this to your actual Item ID in QB
                }
              }
            }
          ],
          CustomerRef: {
            value: cId
          },
          DocNumber: `ENV-${order.id.substring(0, 8)}`,
          TxnDate: order.date
        }

        qbo.createInvoice(invoiceData, (invErr: any, invoice: any) => {
          if (invErr) return reject(invErr)
          resolve(invoice)
        })
      }

      if (!customerId) {
        qbo.createCustomer({ DisplayName: order.customer_name }, (cErr: any, customer: any) => {
          if (cErr) return reject(cErr)
          proceedWithInvoice(customer.Id)
        })
      } else {
        proceedWithInvoice(customerId)
      }
    })
  })
}
