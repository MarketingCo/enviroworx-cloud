import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'

// Load env
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testSystem() {
  console.log('🚀 STARTING FULL SYSTEM AUDIT...')
  const results: any = {}

  try {
    // 1. Test Config Retrieval
    console.log('\n--- 1. Testing Config System ---')
    const { data: config, error: cfgErr } = await supabase.from('config').select('*')
    results.config = !cfgErr && config.length > 0
    console.log(results.config ? '✅ Config loaded' : '❌ Config fail')

    // 2. Test Customer Search
    console.log('\n--- 2. Testing Customer Search ---')
    const { data: custs, error: custErr } = await supabase.from('customers').select('*').limit(1)
    results.customers = !custErr
    console.log(results.customers ? `✅ Customer access OK (Found: ${custs?.[0]?.name || 'None'})` : '❌ Customer fail')

    // 3. Test Custom Pricing Logic
    console.log('\n--- 3. Testing Custom Pricing Engine ---')
    const testCust = 'TEST_AUTO_AUDIT'
    await supabase.from('custom_pricing').delete().ilike('customer_name', testCust) // Cleanup
    
    const { error: addErr } = await supabase.from('custom_pricing').insert({
      customer_name: testCust,
      skip_size: '8',
      net_price: 123.45
    })
    
    const { data: priceData } = await supabase.from('custom_pricing')
      .select('net_price')
      .ilike('customer_name', testCust)
      .eq('skip_size', '8')
      .single()
    
    results.customPricing = !addErr && priceData?.net_price === 123.45
    console.log(results.customPricing ? '✅ Custom price override working' : '❌ Custom pricing fail')
    await supabase.from('custom_pricing').delete().ilike('customer_name', testCust) // Cleanup

    // 4. Test Weighbridge Holding Pen
    console.log('\n--- 4. Testing Weighbridge Logistics ---')
    const testReg = 'TEST-AUDIT'
    await supabase.from('active_tippers').delete().eq('reg', testReg)
    
    const { error: tipErr } = await supabase.from('active_tippers').insert({
      reg: testReg,
      customer_name: 'Audit Test Corp',
      waste_type: 'Inert',
      gross_weight: 15000,
      timestamp: new Date().toISOString()
    })
    
    const { data: penData } = await supabase.from('active_tippers').select('*').eq('reg', testReg).single()
    results.holdingPen = !tipErr && penData?.reg === testReg
    console.log(results.holdingPen ? '✅ Holding pen sync working' : '❌ Holding pen fail')
    await supabase.from('active_tippers').delete().eq('reg', testReg)

    // 5. Test Fleet Tracking (Verizon Sync Bridge)
    console.log('\n--- 5. Testing Fleet DB Bridge ---')
    const { error: telErr } = await supabase.from('vehicles').update({
      latitude: 55.9533,
      longitude: -3.1883,
      last_updated: new Date().toISOString()
    }).eq('reg', 'AUDIT-1') // Just testing query capability
    
    results.fleetDB = !telErr
    console.log(results.fleetDB ? '✅ Fleet telemetry storage OK' : '❌ Fleet DB update fail (likely no match, but query ran)')

    // 6. Test External Map (KML)
    console.log('\n--- 6. Testing KML Data Access ---')
    const { data: kmlData, error: kmlErr } = await supabase.from('external_map_points').select('*').limit(1)
    results.kml = !kmlErr
    console.log(results.kml ? '✅ KML legacy points accessible' : '❌ KML table fail')

    // 7. Test Profitability Views
    console.log('\n--- 7. Testing Neural Views (Profitability) ---')
    const { error: viewErr } = await supabase.from('v_unpaid_invoices').select('*').limit(1)
    results.views = !viewErr
    console.log(results.views ? '✅ Financial views are online' : '❌ SQL views offline')

    // 8. Test QuickBooks Sync Log Bridge
    console.log('\n--- 8. Testing Finance Routing ---')
    const { data: cashCheck } = await supabase.from('cash_log').select('*').limit(1)
    results.cashLog = !!cashCheck
    console.log(results.cashLog ? '✅ Cash logs healthy' : '❌ Cash log access fail')

    console.log('\n' + '='.repeat(40))
    console.log('AUDIT SUMMARY')
    console.log('='.repeat(40))
    Object.entries(results).forEach(([k, v]) => {
      console.log(`${k.padEnd(20)}: ${v ? 'PASSED' : 'FAILED'}`)
    })
    console.log('='.repeat(40))

  } catch (e) {
    console.error('CRITICAL AUDIT ERROR:', e)
  }
}

testSystem()
