import { supabase } from './supabase'

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createProfile({ userId, email, fullName }) {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, email, full_name: fullName || email.split('@')[0], credits: 2, plan: 'Старт' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}
