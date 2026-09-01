import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://aouirnxidicyjdjlkrsm.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWlybnhpZGljeWpkamxrcnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MjQ5MjYsImV4cCI6MjA5MzEwMDkyNn0.6nmNiKHOoJtd3kwjX5mGtP4LUBL00gZHjw35Byw9mCY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
