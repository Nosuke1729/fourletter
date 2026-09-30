import { before, after, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing'
let env
const stamp = { '.sv': 'timestamp' }
const plus = (n) => ({ '.sv': { increment: n } })
const profile = () => ({display_name:'テスト',total_spins:0,collection_count:0,favorite_word:'',created_at:stamp,last_result:'',last_spin_at:0})
const client = (uid='alice') => env.authenticatedContext(uid).database()
const spin = (word='あいうえ', hit=false) => ({
 'profiles/alice/total_spins':plus(1), 'profiles/alice/collection_count':plus(hit?1:0),
 'profiles/alice/last_result':word,'profiles/alice/last_spin_at':stamp,
 ...(hit ? {['collections/alice/'+word]:{first_found_at:stamp,last_found_at:stamp,find_count:plus(1)}} : {})
})
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-fourletter',database:{host:'127.0.0.1',port:9000,rules:readFileSync('database.rules.json','utf8')}})})
after(async()=>{await env.cleanup()})
beforeEach(async()=>{await env.clearDatabase();await env.withSecurityRulesDisabled(async c=>c.database().ref('catalog').set({'たんぽぽ':true,'ひまわり':true}));await client().ref('profiles/alice').set(profile())})
test('owner signup and metadata; public profile; no private fields or anonymous writes',async()=>{
 await assertSucceeds(client('bob').ref('profiles/bob').set(profile()))
 await assertSucceeds(client().ref('profiles/alice/display_name').set('新しい名前'))
 await assertSucceeds(env.unauthenticatedContext().database().ref('profiles/alice').once('value'))
 await assertFails(client('bob').ref('profiles/alice/display_name').set('他人'))
 await assertFails(client().ref('profiles/alice/email').set('private@example.com'))
 await assertFails(env.unauthenticatedContext().database().ref('profiles/x').set(profile()))
})
test('empty result increments one spin only',async()=>{
 await assertSucceeds(client().ref().update(spin()))
 const data=(await client().ref('profiles/alice').once('value')).val();assert.equal(data.total_spins,1);assert.equal(data.collection_count,0)
})
test('valid discovery must atomically record dictionary match and counters',async()=>{
 await assertFails(client().ref().update({...spin('たんぽぽ'), 'profiles/alice/collection_count':plus(1)}))
 await assertSucceeds(client().ref().update(spin('たんぽぽ',true)))
 await assertSucceeds(client().ref('profiles/alice/favorite_word').set('たんぽぽ'))
 await assertFails(client().ref('profiles/alice/favorite_word').set('ひまわり'))
 await assertSucceeds(client().ref('profiles/alice/favorite_word').set(''))
 const data=(await client().ref('collections/alice/たんぽぽ').once('value')).val();assert.equal(data.find_count,1)
 await assertSucceeds(env.unauthenticatedContext().database().ref('collections/alice').once('value'))
})
test('repeat discovery increments count, preserves first date, keeps collection total',async()=>{
 await client().ref().update(spin('たんぽぽ',true))
 const first=(await client().ref('collections/alice/たんぽぽ/first_found_at').once('value')).val()
 await env.withSecurityRulesDisabled(c=>c.database().ref('profiles/alice/last_spin_at').set(1))
 await assertSucceeds(client().ref().update({...spin('たんぽぽ'), 'collections/alice/たんぽぽ':{first_found_at:first,last_found_at:stamp,find_count:plus(1)}}))
 assert.equal((await client().ref('profiles/alice/collection_count').once('value')).val(),1)
 assert.equal((await client().ref('collections/alice/たんぽぽ/find_count').once('value')).val(),2)
})
test('reject fake counts, invalid word, standalone collections and extra discoveries',async()=>{
 await assertFails(client().ref('profiles/alice/total_spins').set(1000))
 await assertFails(client().ref().update(spin('あいうえ',true)))
 await assertFails(client().ref().update(spin('abcde')))
 await assertFails(client().ref('collections/alice/たんぽぽ').set({first_found_at:stamp,last_found_at:stamp,find_count:1}))
 await assertFails(client().ref().update({...spin('たんぽぽ',true),'collections/alice/ひまわり':{first_found_at:stamp,last_found_at:stamp,find_count:1}}))
})
test('reject removal of profile, counters, collected records and timestamp rewriting',async()=>{
 await assertFails(client().ref('profiles/alice').remove())
 await assertFails(client().ref('profiles/alice/total_spins').remove())
 await client().ref().update(spin('たんぽぽ',true))
 await assertFails(client().ref('collections/alice/たんぽぽ').remove())
 await assertFails(client().ref('collections/alice/たんぽぽ/first_found_at').remove())
 await assertFails(client().ref('collections/alice/たんぽぽ/first_found_at').set(1))
})
test('catalog cannot be read or changed; community query bounded and indexed',async()=>{
 const db=env.unauthenticatedContext().database()
 await assertFails(db.ref('catalog').once('value'));await assertFails(client().ref('catalog/あいうえ').set(true))
 await assertFails(db.ref('profiles').once('value'))
 await assertSucceeds(db.ref('profiles').orderByChild('collection_count').limitToLast(30).once('value'))
 await assertFails(db.ref('profiles').orderByChild('collection_count').limitToLast(101).once('value'))
})
