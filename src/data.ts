export type Word = {
  word: string
  label: string
  category: string
  description: string
  source_url: string
}

// Start with headwords visible in public pages showing Kōjien examples.
// Add further entries only after checking the exact four-kana headword.
export const starterWords: Word[] = [
  {
    word: 'あさがお',
    label: '朝顔',
    category: 'しょくぶつ',
    description: '朝に花が開く、夏になじみのある植物。',
    source_url: 'https://www.casio.com/jp/exword/student/junior-high-school/features/search/',
  },
  {
    word: 'ひまわり',
    label: '向日葵',
    category: 'しょくぶつ',
    description: '太陽を思わせる、大きな黄色い花。',
    source_url: 'https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf',
  },
  {
    word: 'おおかみ',
    label: '狼',
    category: 'いきもの',
    description: '群れで暮らす、犬に近い野生の動物。',
    source_url: 'https://kojien.iwanami.co.jp/feature/',
  },
  { word: 'あさどら', label: '朝ドラ', category: 'くらし', description: '朝に放送される連続テレビドラマ。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'いらっと', label: 'いらっと', category: 'きもち', description: 'ふいに、いらだちを感じるようす。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'がっつり', label: 'がっつり', category: 'くらし', description: '十分に、たっぷりと取り組むようす。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'くちぱく', label: '口ぱく', category: 'しぐさ', description: '声を出さずに口だけを動かすこと。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'こあくま', label: '小悪魔', category: 'ひと', description: 'いたずらっぽく、人を魅了する存在。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'ちゃらい', label: 'ちゃらい', category: 'ようす', description: '軽々しく見えるようす。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'のりのり', label: '乗り乗り', category: 'きもち', description: '気分が盛り上がっているようす。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
  { word: 'はやぶさ', label: 'はやぶさ', category: 'しぜん', description: 'すばやく飛ぶ鳥の名。宇宙探査機の名にも。', source_url: 'https://kojien.iwanami.co.jp/feature/' },
]

export const kana = Array.from('あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん')

export function randomKana() {
  return kana[Math.floor(Math.random() * kana.length)]
}

export function makeDemoSpin(words: Word[]) {
  const hit = Math.random() < 0.32 ? words[Math.floor(Math.random() * words.length)] : null
  const letters = hit ? Array.from(hit.word) : Array.from({ length: 4 }, randomKana)
  const word = words.find((item) => item.word === letters.join('')) ?? null
  return { letters, word }
}
