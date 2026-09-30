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
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.json`)
  if (!response.ok) throw new Error('辞書データを読み込めませんでした。')
  const rows = await response.json() as [string, string, string, string, string][]
  const catalog = new Map<string, Word>()
  for (const [word, label, category, description, entry_id] of rows) {
    catalog.set(word, {
      word, label, category, description,
      source_url: 'https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html',
      source_name: 'JMdict', entry_id,
    })
  }
  for (const word of starterWords) catalog.set(word.word, { ...word, source_name: '広辞苑の掲載例' })
  return [...catalog.values()].sort((a, b) => a.word.localeCompare(b.word, 'ja'))
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const { data, error } = await assertDb().from('fourletter_profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchFinds(id: string): Promise<Find[]> {
  const finds: Find[] = []
  const pageSize = 1000
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await assertDb().from('fourletter_collection')
      .select('word,first_found_at,find_count').eq('user_id', id)
      .order('first_found_at', { ascending: false }).order('word', { ascending: true })
      .range(start, start + pageSize - 1)
    if (error) throw error
    finds.push(...(data ?? []))
    if (!data || data.length < pageSize) return finds
  }
}

export async function fetchCommunity(): Promise<Profile[]> {
  const { data, error } = await assertDb().from('fourletter_profiles').select('*').order('collection_count', { ascending: false }).order('total_spins', { ascending: false }).limit(30)
  if (error) throw error
  return data ?? []
}

export async function spinOnline(): Promise<SpinResult> {
  const { data, error } = await assertDb().rpc('spin_four_letters')
  if (error) throw error
  return data as SpinResult
}

export async function setFavorite(word: string | null) {
  const { error } = await assertDb().rpc('fourletter_set_favorite_word', { chosen_word: word })
  if (error) throw error
}

export async function updateName(user: User, displayName: string) {
  const { error } = await assertDb().from('fourletter_profiles').update({ display_name: displayName }).eq('id', user.id)
  if (error) throw error
}
