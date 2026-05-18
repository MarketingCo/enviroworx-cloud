/**
 * SKIP UTILIZATION ANALYTICS (replaces getSkipUtilizationData)
 * + Inventory management functions
 */
import { supabase } from '../supabase'

export async function getSkipUtilization() {
  const { data: inventory } = await supabase.from('inventory').select('*')
  if (!inventory) return { sizes: [], totals: { total: 0, inUse: 0, available: 0, rate: 0 } }

  const sizeMap: Record<string, { total: number; inUse: number; available: number; damaged: number }> = {}
  for (const skip of inventory) {
    const size = skip.skip_size || 'Unknown'
    if (!sizeMap[size]) sizeMap[size] = { total: 0, inUse: 0, available: 0, damaged: 0 }
    sizeMap[size].total++
    if (skip.status === 'Available') sizeMap[size].available++
    else if (['In Use', 'Delivered'].includes(skip.status as string)) sizeMap[size].inUse++
    else if (skip.status === 'Damaged') sizeMap[size].damaged++
  }

  const sizes = Object.entries(sizeMap).map(([size, data]) => ({
    size,
    ...data,
    utilRate: data.total > 0 ? ((data.inUse / data.total) * 100).toFixed(1) + '%' : '0%',
  }))

  const total = inventory.length
  const inUse = inventory.filter(s => ['In Use', 'Delivered'].includes(s.status as string)).length
  const available = inventory.filter(s => s.status === 'Available').length

  return {
    sizes,
    totals: {
      total,
      inUse,
      available,
      rate: total > 0 ? ((inUse / total) * 100).toFixed(1) + '%' : '0%',
    },
  }
}
