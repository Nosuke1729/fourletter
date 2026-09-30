import { createClient, type User } from '@supabase/supabase-js'
import { starterWords, type Word } from './data'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const supabase = url && key ? createClient(url, key) : null

export type Profile = {
  id: string
  display_name: string
  total_spins: number
  collection_count: number
  favorite_word: string | null
  created_at: string
}

export type Find = {
  word: string
  first_found_at: string
  find_count: number
}

export type SpinResult = {
  letters: string[]
  word: string | null
  is_new: boolean
  total_spins: number
  collection_count: number
}

function assertDb() {
  if (!supabase) throw new Error('Supabase が設定されていません。')
  return supabase
}

export async function fetchWords(): Promise<Word[]> {
  if (!supabase) return starterWords
  const { data, error } = await supabase.from('words').select('word,label,category,description,source_url').order('word')
  if (error) throw error
  return data?.length ? data : starterWords
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await assertDb().from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchFinds(id: string): Promise<Find[]> {
  const { data, error } = await assertDb().from('collection').select('word,first_found_at,find_count').eq('user_id', id).order('first_found_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCommunity(): Promise<Profile[]> {
  const { data, error } = await assertDb().from('profiles').select('*').order('collection_count', { ascending: false }).order('total_spins', { ascending: false }).limit(30)
  if (error) throw error
  return data ?? []
}

export async function spinOnline(): Promise<SpinResult> {
  const { data, error } = await assertDb().rpc('spin_four_letters')
  if (error) throw error
  return data as SpinResult
}

export async function setFavorite(word: string | null) {
  const { error } = await assertDb().rpc('set_favorite_word', { chosen_word: word })
  if (error) throw error
}

export async function updateName(user: User, displayName: string) {
  const { error } = await assertDb().from('profiles').update({ display_name: displayName }).eq('id', user.id)
  if (error) throw error
}
