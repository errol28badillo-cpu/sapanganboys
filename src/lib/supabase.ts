import { supabaseClient } from './supabase/client'

export const supabase = supabaseClient
export const isSupabaseConfigured = Boolean(supabase)
