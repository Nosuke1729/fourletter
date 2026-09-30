import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Copy, Heart, LockKeyhole, LogOut, Menu, RotateCcw, Sparkles, UserRound, Users, Volume2, VolumeX, X } from 'lucide-react'
import { makeDemoSpin, randomKana, starterWords, type Word } from './data'
import { fetchCommunity, fetchFinds, fetchProfile, fetchWords, setFavorite, spinOnline, supabase, updateName, type Find, type Profile } from './lib'

type View = 'play' | 'book' | 'people' | 'me' | 'player'
type Outcome = { letters: string[]; word: Word | null; isNew: boolean } | null
type DemoSave = { spins: number; found: Record<string, number>; favorite: string | null }
const DEMO_KEY = 'yomoji-demo-v1'

function readDemo(): DemoSave {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_KEY) || '') as DemoSave
    if (typeof parsed.spins === 'number' && parsed.found && typeof parsed.found === 'object') return parsed
  } catch { /* first visit */ }
  return { spins: 0, found: {}, favorite: null }
}

function currentRoute(): { view: View; playerId: string | null } {
  const params = new URLSearchParams(window.location.search)
  const playerId = params.get('player')
  const view = params.get('view')
  return { view: playerId ? 'player' : view === 'book' || view === 'people' || view === 'me' ? view : 'play', playerId }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export default function App() {
  const initialRoute = currentRoute()
  const [view, setView] = useState<View>(initialRoute.view)
  const [playerId, setPlayerId] = useState<string | null>(initialRoute.playerId)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [finds, setFinds] = useState<Find[]>([])
  const [words, setWords] = useState<Word[]>(starterWords)
  const [players, setPlayers] = useState<Profile[]>([])
  const [visitor, setVisitor] = useState<Profile | null>(null)
  const [visitorFinds, setVisitorFinds] = useState<Find[]>([])
  const [demo, setDemo] = useState<DemoSave>(readDemo)
  const [reels, setReels] = useState(['よ', 'も', 'じ', '！'])
  const [stopped, setStopped] = useState([false, false, false, false])
  const [spinning, setSpinning] = useState(false)
  const [outcome, setOutcome] = useState<Outcome>(null)
  const [selected, setSelected] = useState<Word | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [editName, setEditName] = useState(false)
  const [message, setMessage] = useState('')
  const [sound, setSound] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const busyRef = useRef(false)

  const online = !!supabase
  const foundWords = useMemo(() => new Set(user ? finds.map((find) => find.word) : Object.keys(demo.found)), [user, finds, demo.found])
  const spins = user ? profile?.total_spins ?? 0 : demo.spins
  const collectionCount = user ? profile?.collection_count ?? 0 : foundWords.size
  const favorite = user ? profile?.favorite_word : demo.favorite
  const selectedFind = selected ? (view === 'player' ? visitorFinds.find((find) => find.word === selected.word) : user ? finds.find((find) => find.word === selected.word) : demo.found[selected.word] ? { word: selected.word, find_count: demo.found[selected.word], first_found_at: '' } : undefined) : undefined

  useEffect(() => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo))
  }, [demo])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getUser().then(({ data }) => { if (active) setUser(data.user) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    fetchWords().then(setWords).catch(() => setMessage('ことば一覧を読み込めませんでした。'))
  }, [])

  useEffect(() => {
    if (!user) { setProfile(null); setFinds([]); return }
    Promise.all([fetchProfile(user.id), fetchFinds(user.id)])
      .then(([nextProfile, nextFinds]) => { setProfile(nextProfile); setFinds(nextFinds) })
      .catch(() => setMessage('記録の読み込みに失敗しました。'))
  }, [user])

  useEffect(() => {
    if (view === 'people' && online) fetchCommunity().then(setPlayers).catch(() => setMessage('みんなの記録を読み込めませんでした。'))
  }, [view, online])

  useEffect(() => {
    if (!playerId || !online) return
    Promise.all([fetchProfile(playerId), fetchFinds(playerId)])
      .then(([p, f]) => { setVisitor(p); setVisitorFinds(f) })
      .catch(() => setMessage('プロフィールを読み込めませんでした。'))
  }, [playerId, online])

  useEffect(() => {
    const onPop = () => { const route = currentRoute(); setView(route.view); setPlayerId(route.playerId) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (!message) return
    const timeout = window.setTimeout(() => setMessage(''), 4600)
    return () => window.clearTimeout(timeout)
  }, [message])

  function go(next: View, id?: string) {
    const url = new URL(window.location.href)
    url.search = ''
    if (next === 'player' && id) url.searchParams.set('player', id)
    else if (next !== 'play') url.searchParams.set('view', next)
    window.history.pushState({}, '', url)
    setView(next)
    setPlayerId(id ?? null)
    setMobileMenu(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function blip(frequency = 520) {
    if (!sound) return
    try {
      const context = audioRef.current ?? new AudioContext()
      audioRef.current = context
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.055, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.12)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.12)
    } catch { /* audio is optional */ }
  }

  async function spin() {
    if (busyRef.current) return
    busyRef.current = true
    setSpinning(true)
    setOutcome(null)
    setStopped([false, false, false, false])
    const timer = window.setInterval(() => setReels(Array.from({ length: 4 }, randomKana)), 65)
    const started = performance.now()
    try {
      let letters: string[]
      let found: Word | null
      let isNew: boolean
      if (online && user) {
        const result = await spinOnline()
        letters = result.letters
        found = words.find((word) => word.word === result.word) ?? null
        isNew = result.is_new
        setProfile((old) => old && { ...old, total_spins: result.total_spins, collection_count: result.collection_count })
        if (result.word) fetchFinds(user.id).then(setFinds).catch(() => setMessage('図鑑の更新を読み込めませんでした。'))
      } else {
        const result = makeDemoSpin(words)
        letters = result.letters
        found = result.word
        isNew = !!found && !demo.found[found.word]
        setDemo((old) => ({
          ...old,
          spins: old.spins + 1,
          found: found ? { ...old.found, [found.word]: (old.found[found.word] || 0) + 1 } : old.found,
        }))
      }
      await wait(Math.max(0, 580 - (performance.now() - started)))
      window.clearInterval(timer)
      for (let index = 0; index < 4; index++) {
        setReels((old) => old.map((letter, position) => position === index ? letters[index] : letter))
        setStopped((old) => old.map((value, position) => position === index ? true : value))
        blip(420 + index * 95)
        await wait(index === 3 ? 180 : 270)
      }
      setOutcome({ letters, word: found, isNew })
      if (found) blip(880)
    } catch (error) {
      window.clearInterval(timer)
      setMessage(error instanceof Error ? error.message : '回せませんでした。もう一度お試しください。')
      setReels(['よ', 'も', 'じ', '！'])
    } finally {
      window.clearInterval(timer)
      setSpinning(false)
      busyRef.current = false
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setAuthBusy(true)
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() || 'ことば好き' }, emailRedirectTo: window.location.origin + import.meta.env.BASE_URL } })
        if (error) throw error
        setAuthOpen(false)
        setMessage(data.session ? '登録できました。ようこそ！' : '確認メールを送りました。メールのリンクから登録を完了してください。')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthOpen(false)
        setMessage('おかえりなさい！')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '認証に失敗しました。')
    } finally { setAuthBusy(false) }
  }

  async function chooseFavorite(word: string | null) {
    if (!user) {
      setDemo((old) => ({ ...old, favorite: word }))
      setMessage('おきにいりに設定しました。公開するにはアカウント登録してください。')
      return
    }
    try {
      await setFavorite(word)
      setProfile((old) => old && { ...old, favorite_word: word })
      setMessage(word ? 'おきにいりを公開しました。' : 'おきにいりを外しました。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '保存に失敗しました。') }
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!user) return
    const next = name.trim()
    if (next.length < 2 || next.length > 24) { setMessage('名前は2〜24文字で入力してください。'); return }
    try {
      await updateName(user, next)
      setProfile((old) => old && { ...old, display_name: next })
      setEditName(false)
      setMessage('名前を更新しました。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '更新に失敗しました。') }
  }

  async function copyProfile(id: string) {
    const url = new URL(window.location.href)
    url.search = `?player=${id}`
    try { await navigator.clipboard.writeText(url.href); setMessage('プロフィールのURLをコピーしました。') }
    catch { setMessage(url.href) }
  }

  function wordCard(word: Word, owned: boolean, count?: number) {
    return <button className={`word-card ${owned ? 'unlocked' : 'locked'}`} key={word.word} onClick={() => owned ? setSelected(word) : setMessage('スロットで出会うと、ここに記録されます。')}>
      <span className="word-card-top"><span>{word.category}</span>{owned ? <Sparkles size={15} /> : <LockKeyhole size={15} />}</span>
      <span className="word-card-word">{owned ? word.word : '？？？？'}</span>
      <span className="word-card-label">{owned ? word.label : 'まだ出会っていません'}</span>
      {owned && count && count > 1 && <span className="word-card-count">× {count}</span>}
    </button>
  }

  const navItems: { id: View; label: string; icon: typeof Sparkles }[] = [
    { id: 'play', label: 'あそぶ', icon: Sparkles },
    { id: 'book', label: 'ずかん', icon: BookOpen },
    { id: 'people', label: 'みんな', icon: Users },
    { id: 'me', label: 'マイページ', icon: UserRound },
  ]

  return <div className="app-shell">
    <header className="site-header">
      <button className="brand" onClick={() => go('play')} aria-label="よもじ トップへ"><span className="brand-mark"><i>よ</i><i>も</i><i>じ</i></span><span className="brand-name">よもじ<span className="brand-dot">.</span></span></button>
      <nav className={`desktop-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="メインメニュー">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}><item.icon size={17} strokeWidth={2.3} />{item.label}</button>)}</nav>
      <div className="header-actions">
        {user ? <button className="user-pill" onClick={() => go('me')}><span className="user-avatar">{(profile?.display_name || 'よ').slice(0, 1)}</span><span>{profile?.display_name || 'マイページ'}</span></button> : <button className="login-button" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>登録・ログイン <ArrowRight size={15} /></button>}
        <button className="menu-button" aria-label="メニュー" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
      </div>
    </header>

    <main>
      {view === 'play' && <>
        <section className="hero-grid">
          <div className="hero-copy"><div className="eyebrow"><span className="eyebrow-star">✦</span> ひらがな4文字の、小さな冒険。</div><h1>偶然から、<br /><span>ことば</span>が生まれる。</h1><p>くるくる回る4つの文字。<br />ぴたりと止まって、ことばになったら。<br />あなただけの図鑑に、そっとしまおう。</p><div className="hero-badges"><span>✿ あそぶだけで図鑑がふえる</span><span>♡ おきにいりを見せあおう</span></div><div className="hero-doodle" aria-hidden="true">ことばの<br />たね ✿</div></div>
          <div className="machine-wrap">
            <div className="machine">
              <div className="machine-top"><span className="machine-title"><span className="live-dot" /> YOMOJI SLOT</span><button className="sound-button" onClick={() => setSound(!sound)} aria-label={sound ? '音を消す' : '音を出す'}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></div>
              <div className="machine-intro"><span className="machine-sparkle">✦</span><span>今日は、どんなことばに出会える？</span><span className="machine-sparkle">✦</span></div>
              <div className="reel-frame" aria-label={`現在の文字 ${reels.join('')}`}>{reels.map((letter, index) => <div key={index} className={`reel ${spinning && !stopped[index] ? 'rolling' : ''} ${stopped[index] ? 'stopped' : ''}`}><span className="reel-number">0{index + 1}</span><span className="reel-letter">{letter}</span><span className="reel-underline" /></div>)}</div>
              <div className={`result-area ${outcome?.word ? 'success' : ''}`} aria-live="polite">{outcome ? outcome.word ? <><span className="result-icon">✿</span><div><strong>{outcome.isNew ? 'はじめまして、' : 'また会えたね、'}「{outcome.word.word}」！</strong><small>{outcome.isNew ? '新しいことばを図鑑に記録しました' : '図鑑に出会った回数を記録しました'}</small></div><button onClick={() => setSelected(outcome.word)}>見る <ChevronRight size={15} /></button></> : <><span className="result-icon neutral">✧</span><div><strong>今回はことばにならなかったみたい。</strong><small>次はどんな4文字になるかな？</small></div></> : <><span className="result-icon neutral">✧</span><div><strong>ボタンを押して、4文字をそろえよう</strong><small>左から一文字ずつ止まります</small></div></>}</div>
              <button className="spin-button" onClick={spin} disabled={spinning}><RotateCcw size={21} className={spinning ? 'spin-icon' : ''} />{spinning ? 'まわしています…' : outcome ? 'もういちど回す' : 'スロットを回す'}<span>↗</span></button>
              <p className="machine-note">{user ? '結果はアカウントに保存されます' : 'ゲストの記録はこの端末に保存されます'} <span>·</span> ことばチャンス 約32%</p>
            </div>
            <span className="machine-shadow" />
          </div>
        </section>
        <section className="below-grid"><div className="stat-strip"><div><span className="stat-icon peach">↻</span><span className="stat-number">{spins}</span><span className="stat-label">回まわした</span></div><div><span className="stat-icon yellow">✿</span><span className="stat-number">{collectionCount}<small> / {words.length}</small></span><span className="stat-label">ことばを発見</span></div><div><span className="stat-icon pink">♡</span><span className="stat-number favorite-stat">{favorite || 'まだない'}</span><span className="stat-label">おきにいり</span></div></div><button className="how-card" onClick={() => go('book')}><span className="how-icon"><BookOpen size={25} /></span><span><strong>ことばずかんを見てみよう</strong><small>出会ったことばが、ここに並びます</small></span><ArrowRight size={20} /></button></section>
        <section className="intro-section"><div className="section-kicker">HOW TO PLAY</div><h2>あそびかたは、かんたん。</h2><div className="steps"><div><span>01</span><strong>スロットを回す</strong><p>4つのひらがなが、左から順に止まります。</p></div><div><span>02</span><strong>ことばを発見</strong><p>確認済みの4文字のことばが出たら図鑑へ。</p></div><div><span>03</span><strong>みんなに見せる</strong><p>登録すると、おきにいりと記録を公開できます。</p></div></div></section>
      </>}

      {view === 'book' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">YOUR COLLECTION</div><h1>ことばずかん<span className="heading-flower">✿</span></h1><p>出会った4文字を、少しずつ集めよう。</p></div><div className="heading-counter"><strong>{collectionCount}</strong><span> / {words.length} ことば</span></div></div><div className="progress-track"><span style={{ width: `${words.length ? collectionCount / words.length * 100 : 0}%` }} /></div><div className="book-summary"><span>✦ 見つけたことばをタップして、おきにいりにできます。</span>{!user && <button onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>記録を公開する <ArrowRight size={16} /></button>}</div><div className="word-grid">{words.map((word) => wordCard(word, foundWords.has(word.word), user ? finds.find((find) => find.word === word.word)?.find_count : demo.found[word.word]))}</div><p className="source-note">図鑑は収録を確認した見出し語から始めています。語釈は独自の短い紹介文です。<a href="https://kojien.iwanami.co.jp/" target="_blank" rel="noreferrer">広辞苑について ↗</a></p></section>}

      {view === 'people' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">THE COMMUNITY</div><h1>みんなのことば<span className="heading-flower">♡</span></h1><p>ほかの人は、どんなことばに出会ったかな。</p></div></div>{!online ? <div className="empty-panel"><Users size={38} /><h2>公開プロフィールは準備中です</h2><p>Supabase を接続すると、みんなの図鑑がここに並びます。</p></div> : players.length ? <div className="people-list">{players.map((person, index) => <button className="person-row" key={person.id} onClick={() => go('player', person.id)}><span className="person-rank">{String(index + 1).padStart(2, '0')}</span><span className="person-avatar">{person.display_name.slice(0, 1)}</span><span className="person-name"><strong>{person.display_name}</strong><small>おきにいり：{person.favorite_word || 'まだない'}</small></span><span className="person-stats"><strong>{person.collection_count}</strong> ことば <span>·</span> {person.total_spins} 回</span><ChevronRight size={18} /></button>)}</div> : <div className="empty-panel"><Users size={38} /><h2>最初の発見者になろう</h2><p>登録してことばを集めると、ここに表示されます。</p><button className="small-action" onClick={() => go('play')}>あそびに行く <ArrowRight size={16} /></button></div>}</section>}

      {view === 'me' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">MY PAGE</div><h1>マイページ<span className="heading-flower">✦</span></h1><p>あなたのことばの旅の記録。</p></div></div>{user && profile ? <><div className="profile-hero"><div className="profile-avatar">{profile.display_name.slice(0, 1)}</div><div><div className="profile-caption">ことばコレクター</div><h2>{profile.display_name}</h2><p>出会ったことばを、ここに集めています。</p></div><button className="outline-button" onClick={() => copyProfile(user.id)}><Copy size={16} />プロフィールを共有</button></div><div className="profile-stats"><div><strong>{profile.collection_count}</strong><span>見つけたことば</span></div><div><strong>{profile.total_spins}</strong><span>回まわした</span></div><div><strong>{profile.favorite_word || '—'}</strong><span>おきにいり</span></div></div><div className="profile-actions"><button onClick={() => { setName(profile.display_name); setEditName(true) }}>表示名を変える <ChevronRight size={16} /></button><button onClick={async () => { await supabase?.auth.signOut(); setMessage('ログアウトしました。') }}><LogOut size={16} />ログアウト</button></div><div className="subheading"><h2>あつめたことば</h2><button onClick={() => go('book')}>図鑑を見る <ArrowRight size={16} /></button></div><div className="word-grid compact">{words.filter((word) => foundWords.has(word.word)).map((word) => wordCard(word, true, finds.find((find) => find.word === word.word)?.find_count))}</div>{!finds.length && <div className="empty-panel slim"><p>最初のことばを見つけに行こう。</p><button className="small-action" onClick={() => go('play')}>スロットを回す</button></div>}</> : <div className="signup-panel"><span className="signup-ornament">✿</span><div><div className="section-kicker">KEEP YOUR WORDS</div><h2>ことばとの出会いを、<br />ずっと残そう。</h2><p>登録すると図鑑と回数がアカウントに保存され、<br />おきにいりをみんなに見せられます。</p><button className="primary-small" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>無料でアカウント登録 <ArrowRight size={17} /></button><button className="text-button" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>すでにアカウントをお持ちの方</button>{!online && <small className="setup-note">現在はおためし版です。公開機能には Supabase の接続が必要です。</small>}</div></div>}</section>}

      {view === 'player' && <section className="page-section"><button className="back-button" onClick={() => go('people')}><ArrowLeft size={17} />みんなのことばへ</button>{visitor ? <><div className="profile-hero"><div className="profile-avatar">{visitor.display_name.slice(0, 1)}</div><div><div className="profile-caption">ことばコレクター</div><h1>{visitor.display_name} さんの図鑑</h1><p>おきにいり：<strong>{visitor.favorite_word || 'まだない'}</strong></p></div></div><div className="profile-stats"><div><strong>{visitor.collection_count}</strong><span>見つけたことば</span></div><div><strong>{visitor.total_spins}</strong><span>回まわした</span></div></div><div className="subheading"><h2>あつめたことば</h2></div><div className="word-grid compact">{words.filter((word) => visitorFinds.some((find) => find.word === word.word)).map((word) => wordCard(word, true, visitorFinds.find((find) => find.word === word.word)?.find_count))}</div></> : <div className="empty-panel"><CircleHelp size={36} /><h2>プロフィールを探しています</h2><p>見つからない場合は、みんなの一覧から選びなおしてください。</p></div>}</section>}
    </main>

    <footer className="site-footer"><button className="footer-brand" onClick={() => go('play')}>よもじ<span>.</span></button><span>四文字の偶然を、たのしもう。</span><span>© 2026 よもじ</span></footer>

    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="word-modal" role="dialog" aria-modal="true" aria-label={`${selected.word}の詳細`}><button className="modal-close" onClick={() => setSelected(null)} aria-label="閉じる"><X size={20} /></button><div className="modal-kicker">FOUND WORD <span>✿</span></div><div className="modal-word">{selected.word}</div><div className="modal-kanji">{selected.label}</div><span className="category-pill">{selected.category}</span><p>{selected.description}</p><div className="word-meta"><span>出会った回数</span><strong>{selectedFind?.find_count || 0} 回</strong></div><a className="word-source" href={selected.source_url} target="_blank" rel="noreferrer">収録確認に使った資料を見る ↗</a>{foundWords.has(selected.word) && <button className={`favorite-button ${favorite === selected.word ? 'is-favorite' : ''}`} onClick={() => chooseFavorite(favorite === selected.word ? null : selected.word)}><Heart size={18} fill={favorite === selected.word ? 'currentColor' : 'none'} />{favorite === selected.word ? 'おきにいりに登録中' : 'おきにいりにする'}</button>}</div></div>}

    {authOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}><div className="auth-modal" role="dialog" aria-modal="true" aria-label="アカウント"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="閉じる"><X size={20} /></button><span className="auth-flower">✿</span><h2>{authMode === 'signup' ? 'ことばの旅をはじめよう。' : 'おかえりなさい。'}</h2><p>{authMode === 'signup' ? '図鑑を保存して、みんなと見せあおう。' : 'あなたの図鑑に戻りましょう。'}</p>{online ? <form onSubmit={submitAuth}>{authMode === 'signup' && <label>公開する名前<input value={name} onChange={(event) => setName(event.target.value)} placeholder="ことば好き" maxLength={24} /></label>}<label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} placeholder="6文字以上" required autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} /></label><button className="auth-submit" disabled={authBusy}>{authBusy ? 'しばらくお待ちください…' : authMode === 'signup' ? 'アカウントを作る' : 'ログインする'} <ArrowRight size={17} /></button>{authMode === 'signup' && demo.spins > 0 && <small className="auth-note">ゲストの記録はアカウントに引き継がれません。</small>}</form> : <div className="auth-unavailable">Supabase の接続後に登録できます。今はゲストとしてスロットをお楽しみください。</div>}<button className="switch-auth" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? 'アカウントをお持ちですか？ ログイン' : 'はじめてですか？ 新規登録'}</button></div></div>}

    {editName && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditName(false) }}><div className="auth-modal short" role="dialog" aria-modal="true" aria-label="表示名を変更"><button className="modal-close" onClick={() => setEditName(false)} aria-label="閉じる"><X size={20} /></button><h2>表示名を変える</h2><p>この名前はほかの人にも表示されます。</p><form onSubmit={saveName}><label>公開する名前<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={24} required /></label><button className="auth-submit">保存する <Check size={17} /></button></form></div></div>}
    {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="閉じる"><X size={15} /></button></div>}
  </div>
}
