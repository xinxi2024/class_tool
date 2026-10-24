import test from 'node:test';
import assert from 'node:assert/strict';
import { assignUndercover, compareGuess, drawItems, makeGroups, parseParticipants, randomInt } from '../src/core.js';
import { listState, loadState, replaceAllState, saveState } from '../src/store.js';

class MemoryStorage {
  #data = new Map();
  get length() { return this.#data.size; }
  key(i) { return [...this.#data.keys()][i] ?? null; }
  getItem(k) { return this.#data.get(k) ?? null; }
  setItem(k,v) { this.#data.set(k,String(v)); }
  removeItem(k) { this.#data.delete(k); }
}

test('grouping keeps every participant exactly once and balances 37 across five groups', () => {
  const people = Array.from({length:37},(_,i)=>`p${i}`);
  const groups = makeGroups(people,{groupCount:5,random:()=>0.37});
  assert.deepEqual(groups.map(g=>g.members.length).sort((a,b)=>b-a),[8,8,7,7,7]);
  assert.deepEqual(groups.flatMap(g=>g.members).sort(),people.sort());
  assert.throws(()=>makeGroups([], {groupCount:2}),/名单不能为空/);
});

test('group size mode uses ceiling group count and does not drop remainder', () => {
  const groups=makeGroups(['a','b','c','d','e'],{groupSize:2,random:()=>0.2});
  assert.deepEqual(groups.map(g=>g.members.length).sort(),[1,2,2]);
  assert.equal(groups.flatMap(g=>g.members).length,5);
});

test('anonymous participants require a valid count', () => {
  assert.deepEqual(parseParticipants(' \n\t ',3),['参与者 1','参与者 2','参与者 3']);
  assert.deepEqual(parseParticipants('A, B\nC'),['A','B','C']);
  assert.throws(()=>parseParticipants('',0),/1–500/);
});

test('draw supports unique selection, repeat mode and invalid amounts', () => {
  assert.deepEqual(drawItems(['a','b','c'],3,{random:()=>0}),['a','b','c']);
  assert.deepEqual(drawItems(['x'],4,{allowRepeat:true,random:()=>0}),['x','x','x','x']);
  assert.throws(()=>drawItems(['a'],2),/最多可抽/);
});

test('number bomb narrows bounds and handles exact boundaries', () => {
  assert.deepEqual(compareGuess(1,2,1,5),{status:'low',min:2,max:5});
  assert.deepEqual(compareGuess(5,2,1,5),{status:'high',min:1,max:4});
  assert.deepEqual(compareGuess(2,2,1,5),{status:'correct',min:1,max:5});
  assert.equal(compareGuess(6,2,1,5).status,'invalid');
  assert.equal(randomInt(1,2,()=>0),1);
  assert.equal(randomInt(1,2,()=>0.99),2);
  assert.equal(randomInt(4,4,()=>0),4);
});

test('undercover assigns one shared civilian word and an undercover word', () => {
  const players=assignUndercover(8,['cat','tiger'],2,()=>0.5);
  assert.equal(players.length,8);
  assert.equal(players.filter(p=>p.role==='undercover').length,2);
  assert.equal(players.filter(p=>p.role==='civilian').length,6);
  assert.ok(players.filter(p=>p.role==='civilian').every(p=>p.word==='cat'));
  assert.ok(players.filter(p=>p.role==='undercover').every(p=>p.word==='tiger'));
  assert.throws(()=>assignUndercover(2,['a','b']),/3–50/);
});

test('versioned storage restores, migrates v0 records, and replaces a backup', () => {
  const storage=new MemoryStorage();
  assert.equal(saveState('scores',[{name:'A',score:3}],storage),true);
  assert.deepEqual(loadState('scores',[],storage),[{name:'A',score:3}]);
  storage.setItem('classkit:v1:root:legacy',JSON.stringify({version:0,data:{ok:true}}));
  assert.deepEqual(loadState('legacy',null,storage),{ok:true});
  replaceAllState({format:'classkit-backup',version:1,exportedAt:'now',timer:{minutes:2}} ,storage);
  assert.deepEqual(listState(storage),{timer:{minutes:2}});
});

test('seed JSON preserves original three game decks and event templates', async () => {
  const words=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../data/words.json',import.meta.url),'utf8'));
  const config=JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../data/config.json',import.meta.url),'utf8'));
  assert.deepEqual([words.draw.length,words.undercover.length,words.telephone.length],[48,48,48]);
  assert.ok(config.templates.length>=3);
  assert.ok(!JSON.stringify(config).includes('物联网262'));
});
