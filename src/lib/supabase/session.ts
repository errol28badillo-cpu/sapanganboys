import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { supabaseClient } from './client'

export const getSession = async () => {
  if (!supabaseClient) return null
  const { data } = await supabaseClient.auth.getSession()
  return data.session
}

export const onAuthStateChange = (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
  if (!supabaseClient) return { data: { subscription: { unsubscribe: () => undefined } } }
  return supabaseClient.auth.onAuthStateChange(listener)
}
