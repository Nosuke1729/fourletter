import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Copy, Heart, LockKeyhole, LogOut, Menu, RotateCcw, Sparkles, UserRound, Users, Volume2, VolumeX, X } from 'lucide-react'
import { makeDemoSpin, randomKana, type Word } from './data'
import { errorMessage, fetchCommunity, fetchFinds, fetchProfile, fetchWords, login, logout, online, register, setFavorite, spinOnline, subscribeAuth, updateName, watchFinds, watchProfile, type Find, type Profile, type User } from './lib'

type View = 'play' | 'book' | 'people' | 'me' | 'player' | 'sources'
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
  return { view: playerId ? 'player' : view === 'book' || view === 'people' || view === 'me' || view === 'sources' ? view : 'play', playerId }
}

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

export default function App() {
  const initialRoute = currentRoute()
  const [view, setView] = useState<View>(initialRoute.view)
  const [playerId, setPlayerId] = useState<string | null>(initialRoute.playerId)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!online)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [finds, setFinds] = useState<Find[]>([])
  const [words, setWords] = useState<Word[]>([])
  const [catalogDate, setCatalogDate] = useState('')
  const [catalogCount, setCatalogCount] = useState(0)
  const [bookQuery, setBookQuery] = useState('')
  const [bookVisible, setBookVisible] = useState(48)
  const [players, setPlayers] = useState<Profile[]>([])
  const [visitor, setVisitor] = useState<Profile | null>(null)
  const [visitorLoading, setVisitorLoading] = useState(initialRoute.view === 'player')
  const [visitorFinds, setVisitorFinds] = useState<Find[]>([])
  const [demo, setDemo] = useState<DemoSave>(readDemo)
  const [reels, setReels] = useState(['ひ', 'ら', 'が', 'な'])
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
  const [sound, setSound] = useState(true)
  const [mobileMenu, setMobileMenu] = useState(false)
  const audioRef = useRef<AudioContext | null>(null)
  const busyRef = useRef(false)

  const foundWords = useMemo(() => new Set(user ? finds.map((find) => find.word) : Object.keys(demo.found)), [user, finds, demo.found])
  const spins = user ? profile?.total_spins ?? 0 : demo.spins
  const collectionCount = user ? profile?.collection_count ?? 0 : foundWords.size
  const favorite = user ? profile?.favorite_word : demo.favorite
  const selectedFind = selected ? (view === 'player' ? visitorFinds.find((find) => find.word === selected.word) : user ? finds.find((find) => find.word === selected.word) : demo.found[selected.word] ? { word: selected.word, find_count: demo.found[selected.word], first_found_at: '' } : undefined) : undefined
  const ownedWords = useMemo(() => words.filter((word) => foundWords.has(word.word)), [words, foundWords])
  const visibleBookWords = useMemo(() => ownedWords.filter((word) => !bookQuery || `${word.word} ${word.label}`.includes(bookQuery.trim())).slice(0, bookVisible), [ownedWords, bookQuery, bookVisible])

  useEffect(() => {
    localStorage.setItem(DEMO_KEY, JSON.stringify(demo))
  }, [demo])

  useEffect(() => subscribeAuth((next) => { setUser(next); setAuthReady(true) }, (error) => { setMessage(errorMessage(error)); setAuthReady(true) }), [])

  useEffect(() => {
    fetchWords().then(setWords).catch(() => setMessage('ことば一覧を読み込めませんでした。'))
    fetch(`${import.meta.env.BASE_URL}catalog-meta.json`).then((response) => response.json()).then((meta: { downloaded?: string; count?: number }) => { setCatalogDate(meta.downloaded || ''); setCatalogCount(meta.count || 0) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!user) { setProfile(null); setFinds([]); return }
    const failed = (error: unknown) => setMessage(errorMessage(error))
    const stopProfile = watchProfile(user.id, setProfile, failed)
    const stopFinds = watchFinds(user.id, setFinds, failed)
    return () => { stopProfile(); stopFinds() }
  }, [user])

  useEffect(() => {
    if (view === 'people' && online) fetchCommunity().then(setPlayers).catch(() => setMessage('みんなの記録を読み込めませんでした。'))
  }, [view, online])

  useEffect(() => {
    if (!playerId || !online) return
    let active = true
    setVisitor(null)
    setVisitorFinds([])
    setVisitorLoading(true)
    Promise.all([fetchProfile(playerId), fetchFinds(playerId)])
      .then(([p, f]) => { if (active) { setVisitor(p); setVisitorFinds(f) } })
      .catch(() => { if (active) setMessage('プロフィールを読み込めませんでした。') })
      .finally(() => { if (active) setVisitorLoading(false) })
    return () => { active = false }
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
    if (busyRef.current || !words.length || !authReady) return
    busyRef.current = true
    blip(280)
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
        const result = await spinOnline(words)
        letters = result.letters
        found = words.find((word) => word.word === result.word) ?? null
        isNew = result.is_new
        setProfile((old) => old && { ...old, total_spins: result.total_spins, collection_count: result.collection_count })
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
      await wait(Math.max(0, 400 - (performance.now() - started)))
      window.clearInterval(timer)
      for (let index = 0; index < 4; index++) {
        setReels((old) => old.map((letter, position) => position === index ? letters[index] : letter))
        setStopped((old) => old.map((value, position) => position === index ? true : value))
        blip(420 + index * 95)
        await wait(index === 3 ? 120 : 190)
      }
      setOutcome({ letters, word: found, isNew })
      if (found) { blip(720); blip(960); blip(1200) }
    } catch (error) {
      window.clearInterval(timer)
      setMessage(errorMessage(error))
      setReels(['ひ', 'ら', 'が', 'な'])
    } finally {
      window.clearInterval(timer)
      setSpinning(false)
      busyRef.current = false
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!online) return
    setAuthBusy(true)
    try {
      if (authMode === 'signup') {
        await register(email, password, name)
        setMessage('登録できました。記録をアカウントに保存します。')
      } else {
        await login(email, password)
        setMessage('ログインしました。')
      }
      setAuthOpen(false)
      setPassword('')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setAuthBusy(false) }
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
    { id: 'play', label: '回す', icon: Sparkles },
    { id: 'book', label: '図鑑', icon: BookOpen },
    { id: 'people', label: 'プレイヤー', icon: Users },
    { id: 'me', label: '自分', icon: UserRound },
  ]

  return <div className="app-shell">
    <header className="site-header">
      <button className="brand" onClick={() => go('play')} aria-label="よもじ トップへ"><span className="brand-mark"><i>よ</i><i>も</i><i>じ</i></span><span className="brand-name">YOMOJI<span className="brand-dot">.</span></span></button>
      <nav className={`desktop-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="メインメニュー">{navItems.map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => go(item.id)}><item.icon size={17} strokeWidth={2.3} />{item.label}</button>)}</nav>
      <div className="header-actions">
        {user ? <button className="user-pill" onClick={() => go('me')}><span className="user-avatar">{(profile?.display_name || 'よ').slice(0, 1)}</span><span>{profile?.display_name || 'マイページ'}</span></button> : <button className="login-button" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>登録・ログイン <ArrowRight size={15} /></button>}
        <button className="menu-button" aria-label="メニュー" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button>
      </div>
    </header>

    <main>
      {view === 'play' && <>
        <section className="hero-grid">
          <div className="hero-copy"><div className="eyebrow">FOUR LETTER SLOT <span>/</span> 2026</div><h1>四文字が、<br /><span>揃う瞬間。</span></h1><p>ひらがなを4つ、順に止める。<br />辞書にある語が揃えば、あなたの図鑑へ。</p><div className="hero-subline"><span />{words.length.toLocaleString('ja-JP')} WORDS IN PLAY</div></div>
          <div className="machine-wrap"><div className={`machine ${outcome?.word ? 'machine-win' : ''}`}>
            {outcome?.word && <div className="win-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} style={{ '--ray': `${index * 30}deg` } as CSSProperties} />)}</div>}
            <div className="machine-top"><span className="machine-title"><span className="live-dot" /> 01 / FOUR REELS</span><button className="sound-button" onClick={() => setSound(!sound)} aria-label={sound ? '音を消す' : '音を出す'}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></div>
            <div className="machine-intro"><span>{spinning ? 'ROLLING' : outcome?.word ? 'WORD FOUND' : 'READY TO SPIN'}</span><span className="machine-intro-line" /><span>YOMOJI</span></div>
            <div className="reel-frame" aria-label={`現在の文字 ${reels.join('')}`}>{reels.map((letter, index) => <div key={index} className={`reel ${spinning && !stopped[index] ? 'rolling' : ''} ${stopped[index] ? 'stopped' : ''}`}><span className="reel-number">0{index + 1}</span><span className="reel-letter">{letter}</span><span className="reel-underline" /></div>)}</div>
            <div className={`result-area ${outcome?.word ? 'success' : ''}`} aria-live="polite">{outcome ? outcome.word ? <><div><strong>{outcome.isNew ? 'NEW WORD' : 'WORD FOUND'} <span>— {outcome.word.word}</span></strong><small>{outcome.isNew ? '図鑑に新しい語を追加しました' : '発見回数を更新しました'}</small></div><button onClick={() => setSelected(outcome.word)}>詳細 <ChevronRight size={15} /></button></> : <div><strong>NO MATCH</strong><small>辞書語に一致しませんでした</small></div> : <div><strong>READY</strong><small>回すと左から一文字ずつ止まります</small></div>}</div>
            <button className="spin-button" onClick={spin} disabled={spinning || !words.length || !authReady}><RotateCcw size={20} className={spinning ? 'spin-icon' : ''} />{!words.length ? '辞書を読み込み中' : !authReady ? 'アカウントを確認中' : spinning ? '回転中' : outcome ? 'もう一度回す' : 'スロットを回す'}<span>↗</span></button>
            <p className="machine-note">{user ? 'アカウントに保存' : 'この端末に保存'} <span>·</span> 辞書語の抽選率 32% + 偶然一致</p>
          </div><span className="machine-shadow" /></div>
        </section>
        <section className="below-grid"><div className="stat-strip"><div><span className="stat-icon">01</span><span className="stat-number">{spins.toLocaleString('ja-JP')}</span><span className="stat-label">総回転数</span></div><div><span className="stat-icon">02</span><span className="stat-number">{collectionCount.toLocaleString('ja-JP')}<small> / {words.length.toLocaleString('ja-JP')}</small></span><span className="stat-label">発見した語</span></div><div><span className="stat-icon">03</span><span className="stat-number favorite-stat">{favorite || '—'}</span><span className="stat-label">お気に入り</span></div></div><button className="how-card" onClick={() => go('book')}><span>COLLECTION</span><strong>図鑑を見る</strong><ArrowRight size={19} /></button></section>
        <section className="intro-section"><div className="section-kicker">THE RULES</div><div className="steps"><div><span>01</span><strong>回す</strong><p>4文字が順番に止まる。</p></div><div><span>02</span><strong>発見する</strong><p>辞書語なら図鑑に記録。</p></div><div><span>03</span><strong>公開する</strong><p>お気に入りと記録を共有。</p></div></div></section>
      </>}

      {view === 'book' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">COLLECTION</div><h1>図鑑</h1><p>見つけたことばを記録する。</p></div><div className="heading-counter"><strong>{collectionCount}</strong><span> / {words.length.toLocaleString('ja-JP')}</span></div></div><div className="progress-track"><span style={{ width: `${words.length ? collectionCount / words.length * 100 : 0}%` }} /></div><div className="book-tools"><span>発見済み {collectionCount.toLocaleString('ja-JP')} 語 <span className="tool-divider">/</span> 未発見 {Math.max(0, words.length - collectionCount).toLocaleString('ja-JP')} 語</span><input type="search" value={bookQuery} onChange={(event) => { setBookQuery(event.target.value); setBookVisible(48) }} placeholder="発見したことばを検索" aria-label="発見したことばを検索" /></div>{ownedWords.length ? <><div className="word-grid">{visibleBookWords.map((word) => wordCard(word, true, user ? finds.find((find) => find.word === word.word)?.find_count : demo.found[word.word]))}</div>{visibleBookWords.length < ownedWords.filter((word) => !bookQuery || `${word.word} ${word.label}`.includes(bookQuery.trim())).length && <button className="load-more" onClick={() => setBookVisible((count) => count + 48)}>さらに表示 <ArrowRight size={16} /></button>}</> : <div className="empty-panel"><BookOpen size={36} /><h2>図鑑はまだ空です</h2><p>最初のことばを見つけよう。</p><button className="small-action" onClick={() => go('play')}>スロットを回す <ArrowRight size={16} /></button></div>}<div className="source-note">収録語には JMdict を使用しています。広辞苑で個別に確認した語も含みます。<button onClick={() => go('sources')}>出典と利用条件 <ArrowRight size={14} /></button></div></section>}

      {view === 'people' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">THE COMMUNITY</div><h1>プレイヤー</h1><p>公開された収集記録。</p></div></div>{!online ? <div className="empty-panel"><Users size={38} /><h2>公開プロフィールは準備中です</h2><p>接続の準備ができると、みんなの図鑑がここに並びます。</p></div> : players.length ? <div className="people-list">{players.map((person, index) => <button className="person-row" key={person.id} onClick={() => go('player', person.id)}><span className="person-rank">{String(index + 1).padStart(2, '0')}</span><span className="person-avatar">{person.display_name.slice(0, 1)}</span><span className="person-name"><strong>{person.display_name}</strong><small>おきにいり：{person.favorite_word || 'まだない'}</small></span><span className="person-stats"><strong>{person.collection_count}</strong> ことば <span>·</span> {person.total_spins} 回</span><ChevronRight size={18} /></button>)}</div> : <div className="empty-panel"><Users size={38} /><h2>最初の発見者になろう</h2><p>登録してことばを集めると、ここに表示されます。</p><button className="small-action" onClick={() => go('play')}>あそびに行く <ArrowRight size={16} /></button></div>}</section>}

      {view === 'me' && <section className="page-section"><div className="page-heading"><div><div className="section-kicker">MY PAGE</div><h1>プロフィール</h1><p>あなたの収集記録。</p></div></div>{user && profile ? <><div className="profile-hero"><div className="profile-avatar">{profile.display_name.slice(0, 1)}</div><div><div className="profile-caption">ことばコレクター</div><h2>{profile.display_name}</h2><p>出会ったことばを、ここに集めています。</p></div><button className="outline-button" onClick={() => copyProfile(user.id)}><Copy size={16} />プロフィールを共有</button></div><div className="profile-stats"><div><strong>{profile.collection_count}</strong><span>見つけたことば</span></div><div><strong>{profile.total_spins}</strong><span>回まわした</span></div><div><strong>{profile.favorite_word || '—'}</strong><span>おきにいり</span></div></div><div className="profile-actions"><button onClick={() => { setName(profile.display_name); setEditName(true) }}>表示名を変える <ChevronRight size={16} /></button><button onClick={async () => { await logout(); setMessage('ログアウトしました。') }}><LogOut size={16} />ログアウト</button></div><div className="subheading"><h2>あつめたことば</h2><button onClick={() => go('book')}>図鑑を見る <ArrowRight size={16} /></button></div><div className="word-grid compact">{words.filter((word) => foundWords.has(word.word)).map((word) => wordCard(word, true, finds.find((find) => find.word === word.word)?.find_count))}</div>{!finds.length && <div className="empty-panel slim"><p>最初のことばを見つけに行こう。</p><button className="small-action" onClick={() => go('play')}>スロットを回す</button></div>}</> : <div className="signup-panel"><span className="signup-ornament">✿</span><div><div className="section-kicker">KEEP YOUR WORDS</div><h2>ことばとの出会いを、<br />ずっと残そう。</h2><p>登録すると図鑑と回数がアカウントに保存され、<br />おきにいりをみんなに見せられます。</p><button className="primary-small" onClick={() => { setAuthMode('signup'); setAuthOpen(true) }}>無料でアカウント登録 <ArrowRight size={17} /></button><button className="text-button" onClick={() => { setAuthMode('login'); setAuthOpen(true) }}>すでにアカウントをお持ちの方</button>{!online && <small className="setup-note">現在はおためし版です。アカウント保存は準備中です。</small>}</div></div>}</section>}

      {view === 'player' && <section className="page-section"><button className="back-button" onClick={() => go('people')}><ArrowLeft size={17} />みんなのことばへ</button>{visitor ? <><div className="profile-hero"><div className="profile-avatar">{visitor.display_name.slice(0, 1)}</div><div><div className="profile-caption">ことばコレクター</div><h1>{visitor.display_name} さんの図鑑</h1><p>おきにいり：<strong>{visitor.favorite_word || 'まだない'}</strong></p></div></div><div className="profile-stats"><div><strong>{visitor.collection_count}</strong><span>見つけたことば</span></div><div><strong>{visitor.total_spins}</strong><span>回まわした</span></div></div><div className="subheading"><h2>あつめたことば</h2></div><div className="word-grid compact">{words.filter((word) => visitorFinds.some((find) => find.word === word.word)).map((word) => wordCard(word, true, visitorFinds.find((find) => find.word === word.word)?.find_count))}</div></> : <div className="empty-panel"><CircleHelp size={36} /><h2>{visitorLoading ? 'プロフィールを読み込み中' : 'プロフィールが見つかりません'}</h2><p>見つからない場合は、みんなの一覧から選びなおしてください。</p></div>}</section>}
      {view === 'sources' && <section className="page-section sources-page"><div className="page-heading"><div><div className="section-kicker">DATA & ATTRIBUTION</div><h1>出典とデータ</h1><p>このゲームの辞書語について。</p></div></div><div className="source-panel"><span className="source-index">01 / MAIN DICTIONARY</span><h2>JMdict</h2><p>Electronic Dictionary Research and Development Group（EDRDG）の辞書データから、読みがひらがな4文字の見出し語を {catalogCount.toLocaleString('ja-JP')} 語抽出しています。広辞苑で確認した独立の2語を加え、現在の候補は {words.length.toLocaleString('ja-JP')} 語です。意味欄の英語グロスも同データに由来します。語の内容による除外はしていません。</p><div className="source-links"><a href="https://www.edrdg.org/wiki/JMdict-EDICT_Dictionary_Project.html" target="_blank" rel="noreferrer">JMdict 公式情報 ↗</a><a href="https://www.edrdg.org/edrdg/licence.html" target="_blank" rel="noreferrer">利用条件 ↗</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0 ↗</a></div><small>使用スナップショット: {catalogDate || '読み込み中'}。読みが同じ複数の見出しは一つにまとめ、代表の表記と英語グロスを表示します。</small></div><div className="source-panel"><span className="source-index">02 / VERIFIED EXAMPLES</span><h2>広辞苑の確認例</h2><p>11語は岩波書店の広辞苑紹介と、辞書製品の検索例で個別に収録を確認した語です。広辞苑本文や語釈の複製は使用していません。JMdictの全見出しが広辞苑にも載るという意味ではありません。</p><div className="source-links"><a href="https://kojien.iwanami.co.jp/feature/" target="_blank" rel="noreferrer">岩波書店の紹介 ↗</a><a href="https://www.casio.com/jp/exword/student/junior-high-school/features/search/" target="_blank" rel="noreferrer">CASIOの検索例 ↗</a><a href="https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf" target="_blank" rel="noreferrer">SHARPの検索例 ↗</a></div></div></section>}
    </main>

    <footer className="site-footer"><button className="footer-brand" onClick={() => go('play')}>YOMOJI<span>.</span></button><button className="footer-source" onClick={() => go('sources')}>語彙: JMdict (EDRDG) · 出典と利用条件</button><span>© 2026 YOMOJI</span></footer>

    {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="word-modal" role="dialog" aria-modal="true" aria-label={`${selected.word}の詳細`}><button className="modal-close" onClick={() => setSelected(null)} aria-label="閉じる"><X size={20} /></button><div className="modal-kicker">DICTIONARY ENTRY</div><div className="modal-word">{selected.word}</div><div className="modal-kanji">{selected.label}</div><span className="category-pill">{selected.category}</span><p>{selected.description}</p><div className="word-meta"><span>発見回数</span><strong>{selectedFind?.find_count || 0} 回</strong></div><a className="word-source" href={selected.source_url} target="_blank" rel="noreferrer">{selected.source_name || '広辞苑の掲載例'} {selected.entry_id ? `#${selected.entry_id}` : ''} / 出典 ↗</a>{foundWords.has(selected.word) && <button className={`favorite-button ${favorite === selected.word ? 'is-favorite' : ''}`} onClick={() => chooseFavorite(favorite === selected.word ? null : selected.word)}><Heart size={18} fill={favorite === selected.word ? 'currentColor' : 'none'} />{favorite === selected.word ? 'おきにいりに登録中' : 'おきにいりにする'}</button>}</div></div>}

    {authOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAuthOpen(false) }}><div className="auth-modal" role="dialog" aria-modal="true" aria-label="アカウント"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="閉じる"><X size={20} /></button><span className="auth-flower">✿</span><h2>{authMode === 'signup' ? 'ことばの旅をはじめよう。' : 'おかえりなさい。'}</h2><p>{authMode === 'signup' ? '図鑑を保存して、みんなと見せあおう。' : 'あなたの図鑑に戻りましょう。'}</p>{online ? <form onSubmit={submitAuth}>{authMode === 'signup' && <label>公開する名前<input value={name} onChange={(event) => setName(event.target.value)} placeholder="ことば好き" maxLength={24} /></label>}<label>メールアドレス<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" /></label><label>パスワード<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} placeholder="6文字以上" required autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} /></label><button className="auth-submit" disabled={authBusy}>{authBusy ? 'しばらくお待ちください…' : authMode === 'signup' ? 'アカウントを作る' : 'ログインする'} <ArrowRight size={17} /></button>{authMode === 'signup' && demo.spins > 0 && <small className="auth-note">ゲストの記録はアカウントに引き継がれません。</small>}</form> : <div className="auth-unavailable">アカウント保存の準備ができると登録できます。今はゲストとしてスロットをお楽しみください。</div>}<button className="switch-auth" onClick={() => setAuthMode(authMode === 'signup' ? 'login' : 'signup')}>{authMode === 'signup' ? 'アカウントをお持ちですか？ ログイン' : 'はじめてですか？ 新規登録'}</button></div></div>}

    {editName && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditName(false) }}><div className="auth-modal short" role="dialog" aria-modal="true" aria-label="表示名を変更"><button className="modal-close" onClick={() => setEditName(false)} aria-label="閉じる"><X size={20} /></button><h2>表示名を変える</h2><p>この名前はほかの人にも表示されます。</p><form onSubmit={saveName}><label>公開する名前<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={24} required /></label><button className="auth-submit">保存する <Check size={17} /></button></form></div></div>}
    {message && <div className="toast" role="status">{message}<button onClick={() => setMessage('')} aria-label="閉じる"><X size={15} /></button></div>}
  </div>
}
