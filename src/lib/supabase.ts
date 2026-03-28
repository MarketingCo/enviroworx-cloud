import { createClient } from '@supabase/supabase-js'

// Enviroworx Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials. Please check .env.local')
}

// Using service role key — bypasses RLS completely
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  realtime: {
    params: { eventsPerSecond: 10 }
  }
})

// Admin client (same as above since we're using service role)
export const supabaseAdmin = supabase
