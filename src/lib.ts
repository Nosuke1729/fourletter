import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, updateProfile, type User as FirebaseUser } from 'firebase/auth'
import { connectDatabaseEmulator, get, getDatabase, increment, limitToLast, onValue, orderByChild, query, ref, serverTimestamp, set, update, type DataSnapshot } from 'firebase/database'
import config from './firebase-config.json'
import { makeDemoSpin, starterWords, type Word } from './data'

export const online = !!(config.apiKey && config.projectId && config.databaseURL && config.appId)
const app = online ? initializeApp(config) : null
const auth = app ? getAuth(app) : null
const database = app ? getDatabase(app) : null
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATORS === 'true' && auth && database) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectDatabaseEmulator(database, '127.0.0.1', 9000)
}

export type User = { id: string }
export type Profile = { id: string; display_name: string; total_spins: number; collection_count: number; favorite_word: string | null; created_at: string }
export type Find = { word: string; first_found_at: string; find_count: number }
export type SpinResult = { letters: string[]; word: string | null; is_new: boolean; total_spins: number; collection_count: number }

function db() {
  if (!database) throw new Error('接続の準備ができていません。')
  return database
}
function currentId() {
  if (!auth?.currentUser) throw new Error('ログインしてください。')
  return auth.currentUser.uid
}
function profileFrom(snapshot: DataSnapshot): Profile | null {
  if (!snapshot.exists()) return null
  const value = snapshot.val()
  return { ...value, id: snapshot.key!, favorite_word: value.favorite_word || null, created_at: new Date(value.created_at).toISOString() }
}
function findsFrom(snapshot: DataSnapshot): Find[] {
  const items: Find[] = []
  snapshot.forEach((child) => { const value = child.val(); items.push({ word: child.key!, find_count: value.find_count, first_found_at: new Date(value.first_found_at).toISOString() }) })
  return items.sort((a, b) => b.first_found_at.localeCompare(a.first_found_at))
}
async function ensureProfile(user: FirebaseUser, name?: string) {
  const target = ref(db(), `profiles/${user.uid}`)
  if ((await get(target)).exists()) return
  try {
    await set(target, { display_name: name || user.displayName || 'ことば好き', total_spins: 0, collection_count: 0, favorite_word: '', created_at: serverTimestamp(), last_result: '', last_spin_at: 0 })
  } catch (error) {
    // Another auth callback may have created the same profile concurrently.
    if (!(await get(target)).exists()) throw error
  }
}
export function subscribeAuth(callback: (user: User | null) => void, failed: (error: unknown) => void) {
  if (!auth) return () => {}
  let active = true
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    try {
      if (user) await ensureProfile(user)
      if (active && auth.currentUser?.uid === user?.uid) callback(user ? { id: user.uid } : null)
    } catch (error) { if (active) failed(error) }
  })
  return () => { active = false; unsubscribe() }
}
export async function register(email: string, password: string, name: string) {
  if (!auth) throw new Error('接続の準備ができていません。')
  const displayName = name.trim() || 'ことば好き'
  if (displayName.length < 2 || displayName.length > 24) throw new Error('名前は2〜24文字で入力してください。')
  const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
  await updateProfile(user, { displayName })
  await ensureProfile(user, displayName)
  await update(ref(db(), `profiles/${user.uid}`), { display_name: displayName })
}
export async function login(email: string, password: string) {
  if (!auth) throw new Error('接続の準備ができていません。')
  await signInWithEmailAndPassword(auth, email.trim(), password)
}
export async function logout() { if (auth) await signOut(auth) }
export function errorMessage(error: unknown) {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'このメールアドレスは登録済みです。ログインしてください。',
    'auth/invalid-email': 'メールアドレスを確認してください。',
    'auth/invalid-credential': 'メールアドレスかパスワードが違います。',
    'auth/weak-password': 'パスワードは6文字以上にしてください。',
    'auth/too-many-requests': '少し時間を置いてからお試しください。',
    'auth/network-request-failed': '接続できませんでした。通信状態を確認してください。',
    'PERMISSION_DENIED': '保存できませんでした。もう一度お試しください。',
  }
  return messages[code] || (error instanceof Error ? error.message : '処理に失敗しました。')
}
export async function fetchWords(): Promise<Word[]> {
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.json`)
  if (!response.ok) throw new Error('辞書データを読み込めませんでした。')
  const rows = await response.json() as [string, string, string, string, string][]
  const catalog = new Map<string, Word>()
  for (const [word, label, category, description, entry_id] of rows) catalog.set(word, { word, label, category, description, source_url: 'https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html', source_name: 'JMdict', entry_id })
  for (const word of starterWords) catalog.set(word.word, { ...word, source_name: '広辞苑の掲載例' })
  return [...catalog.values()].sort((a, b) => a.word.localeCompare(b.word, 'ja'))
}
export async function fetchProfile(id: string) { return profileFrom(await get(ref(db(), `profiles/${id}`))) }
export async function fetchFinds(id: string) { return findsFrom(await get(ref(db(), `collections/${id}`))) }
export function watchProfile(id: string, callback: (profile: Profile | null) => void, failed: (error: unknown) => void) { return onValue(ref(db(), `profiles/${id}`), (snapshot) => callback(profileFrom(snapshot)), failed) }
export function watchFinds(id: string, callback: (finds: Find[]) => void, failed: (error: unknown) => void) { return onValue(ref(db(), `collections/${id}`), (snapshot) => callback(findsFrom(snapshot)), failed) }
export async function fetchCommunity(): Promise<Profile[]> {
  const snapshot = await get(query(ref(db(), 'profiles'), orderByChild('collection_count'), limitToLast(30)))
  const profiles: Profile[] = []
  snapshot.forEach((child) => { const profile = profileFrom(child); if (profile) profiles.push(profile) })
  return profiles.sort((a, b) => b.collection_count - a.collection_count || b.total_spins - a.total_spins)
}
export async function spinOnline(words: Word[]): Promise<SpinResult> {
  const id = currentId()
  const result = makeDemoSpin(words)
  const word = result.word?.word ?? null
  for (let attempt = 0; attempt < 3; attempt++) {
    const owned = word ? (await get(ref(db(), `collections/${id}/${word}`))).val() : null
    const isNew = !!word && !owned
    const updates: Record<string, unknown> = {
      [`profiles/${id}/total_spins`]: increment(1),
      [`profiles/${id}/collection_count`]: increment(isNew ? 1 : 0),
      [`profiles/${id}/last_result`]: result.letters.join(''),
      [`profiles/${id}/last_spin_at`]: serverTimestamp(),
    }
    if (word) updates[`collections/${id}/${word}`] = { find_count: increment(1), first_found_at: owned?.first_found_at ?? serverTimestamp(), last_found_at: serverTimestamp() }
    try {
      await update(ref(db()), updates)
      const profile = await fetchProfile(id)
      if (!profile) throw new Error('プロフィールを読み込めませんでした。')
      return { letters: result.letters, word, is_new: isNew, total_spins: profile.total_spins, collection_count: profile.collection_count }
    } catch (error) {
      if (attempt === 2 || !(error instanceof Error) || !/permission_denied/i.test(error.message)) throw error
      // Concurrent tabs can discover the same word or reach the spin interval.
      await new Promise((resolve) => setTimeout(resolve, 550))
    }
  }
  throw new Error('保存できませんでした。')
}
export async function setFavorite(word: string | null) { await update(ref(db(), `profiles/${currentId()}`), { favorite_word: word || '' }) }
export async function updateName(user: User, name: string) { await update(ref(db(), `profiles/${user.id}`), { display_name: name }) }
