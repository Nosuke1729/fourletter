-- Run once in the dedicated fourletter Supabase project.
-- Only short headwords and original descriptions are stored, not dictionary text.
create schema if not exists private;

create table if not exists public.words (
  word text primary key check (char_length(word) = 4 and word ~ '^[ぁ-ん]{4}$'),
  label text not null,
  category text not null,
  description text not null,
  source_url text not null
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'ことば好き' check (char_length(display_name) between 2 and 24),
  total_spins integer not null default 0 check (total_spins >= 0),
  collection_count integer not null default 0 check (collection_count >= 0),
  favorite_word text references public.words(word),
  created_at timestamptz not null default now()
);

create table if not exists public.collection (
  user_id uuid not null references public.profiles(id) on delete cascade,
  word text not null references public.words(word),
  first_found_at timestamptz not null default now(),
  find_count integer not null default 1 check (find_count > 0),
  primary key (user_id, word)
);

create index if not exists profiles_leaderboard on public.profiles (collection_count desc, total_spins desc);

alter table public.words enable row level security;
alter table public.profiles enable row level security;
alter table public.collection enable row level security;

revoke all on public.words, public.profiles, public.collection from public, anon, authenticated;
grant select on public.words, public.profiles, public.collection to anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy "word catalog is public" on public.words for select to anon, authenticated using (true);
create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "owner can rename" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "collections are public" on public.collection for select to anon, authenticated using (true);

-- Auth trigger creates the public profile. Metadata supplies a display name only.
create or replace function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare supplied_name text;
begin
  supplied_name := trim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  if char_length(supplied_name) not between 2 and 24 then supplied_name := 'ことば好き'; end if;
  insert into public.profiles(id, display_name) values (new.id, supplied_name)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_fourletter on auth.users;
create trigger on_auth_user_created_fourletter after insert on auth.users
for each row execute function private.create_profile();

-- The public wrapper is invoker-rights. The privileged operation lives in a
-- non-exposed schema, checks the caller, and accepts no client-supplied result.
create or replace function private.perform_spin()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid();
  letters text[] := array['あ','い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と','な','に','ぬ','ね','の','は','ひ','ふ','へ','ほ','ま','み','む','め','も','や','ゆ','よ','ら','り','る','れ','ろ','わ','を','ん'];
  result_text text;
  matched_word text;
  new_word boolean := false;
  next_spins integer;
  next_count integer;
begin
  if player_id is null then raise exception 'ログインしてください' using errcode = '28000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(player_id::text));
  insert into public.profiles (id) values (player_id) on conflict do nothing;

  if pg_catalog.random() < 0.32 then
    select w.word into result_text from public.words w order by pg_catalog.random() limit 1;
  end if;
  if result_text is null then
    result_text := '';
    for i in 1..4 loop
      result_text := result_text || letters[1 + pg_catalog.floor(pg_catalog.random() * 46)::integer];
    end loop;
  end if;

  select w.word into matched_word from public.words w where w.word = result_text;
  if matched_word is not null then
    select not exists (
      select 1 from public.collection c where c.user_id = player_id and c.word = matched_word
    ) into new_word;
    insert into public.collection (user_id, word) values (player_id, matched_word)
    on conflict (user_id, word) do update set find_count = public.collection.find_count + 1;
  end if;

  update public.profiles
  set total_spins = total_spins + 1,
      collection_count = collection_count + case when new_word then 1 else 0 end
  where id = player_id
  returning total_spins, collection_count into next_spins, next_count;

  return pg_catalog.jsonb_build_object(
    'letters', pg_catalog.jsonb_build_array(
      pg_catalog.substr(result_text, 1, 1), pg_catalog.substr(result_text, 2, 1),
      pg_catalog.substr(result_text, 3, 1), pg_catalog.substr(result_text, 4, 1)
    ),
    'word', matched_word, 'is_new', new_word,
    'total_spins', next_spins, 'collection_count', next_count
  );
end;
$$;

create or replace function public.spin_four_letters()
returns jsonb language sql security invoker set search_path = '' as $$
  select private.perform_spin();
$$;

create or replace function private.choose_favorite(chosen_word text)
returns void language plpgsql security definer set search_path = '' as $$
declare player_id uuid := auth.uid();
begin
  if player_id is null then raise exception 'ログインしてください' using errcode = '28000'; end if;
  if chosen_word is not null and not exists (
    select 1 from public.collection c where c.user_id = player_id and c.word = chosen_word
  ) then raise exception '図鑑にないことばは選べません'; end if;
  update public.profiles set favorite_word = chosen_word where id = player_id;
end;
$$;

create or replace function public.set_favorite_word(chosen_word text)
returns void language sql security invoker set search_path = '' as $$
  select private.choose_favorite(chosen_word);
$$;

revoke all on function private.create_profile() from public, anon, authenticated;
revoke all on function private.perform_spin() from public, anon, authenticated;
revoke all on function private.choose_favorite(text) from public, anon, authenticated;
revoke all on function public.spin_four_letters() from public, anon, authenticated;
revoke all on function public.set_favorite_word(text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.perform_spin() to authenticated;
grant execute on function private.choose_favorite(text) to authenticated;
grant execute on function public.spin_four_letters() to authenticated;
grant execute on function public.set_favorite_word(text) to authenticated;

insert into public.words (word, label, category, description, source_url) values
  ('あさがお', '朝顔', 'しょくぶつ', '朝に花が開く、夏になじみのある植物。', 'https://www.casio.com/jp/exword/student/junior-high-school/features/search/'),
  ('ひまわり', '向日葵', 'しょくぶつ', '太陽を思わせる、大きな黄色い花。', 'https://www.sharp.co.jp/support/dictionary/doc/pwa8200_mn.pdf'),
  ('おおかみ', '狼', 'いきもの', '群れで暮らす、犬に近い野生の動物。', 'https://kojien.iwanami.co.jp/feature/'),
  ('あさどら', '朝ドラ', 'くらし', '朝に放送される連続テレビドラマ。', 'https://kojien.iwanami.co.jp/feature/'),
  ('いらっと', 'いらっと', 'きもち', 'ふいに、いらだちを感じるようす。', 'https://kojien.iwanami.co.jp/feature/'),
  ('がっつり', 'がっつり', 'くらし', '十分に、たっぷりと取り組むようす。', 'https://kojien.iwanami.co.jp/feature/'),
  ('くちぱく', '口ぱく', 'しぐさ', '声を出さずに口だけを動かすこと。', 'https://kojien.iwanami.co.jp/feature/'),
  ('こあくま', '小悪魔', 'ひと', 'いたずらっぽく、人を魅了する存在。', 'https://kojien.iwanami.co.jp/feature/'),
  ('ちゃらい', 'ちゃらい', 'ようす', '軽々しく見えるようす。', 'https://kojien.iwanami.co.jp/feature/'),
  ('のりのり', '乗り乗り', 'きもち', '気分が盛り上がっているようす。', 'https://kojien.iwanami.co.jp/feature/'),
  ('はやぶさ', 'はやぶさ', 'しぜん', 'すばやく飛ぶ鳥の名。宇宙探査機の名にも。', 'https://kojien.iwanami.co.jp/feature/')
on conflict (word) do nothing;
