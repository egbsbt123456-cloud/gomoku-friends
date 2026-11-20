import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html=await readFile(new URL('../portable/五子棋-直接打开.html',import.meta.url),'utf8');
assert.ok(!/<script[^>]+src=/.test(html),'Offline release must not require external scripts');
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,2);
for(const [i,match] of scripts.entries())new vm.Script(match[1],{filename:'portable-inline-'+i+'.js'});
for(const asset of ['board-wood','wood-grain','stone-shadow','__GOMOKU_WORKER_URL__'])assert.ok(html.includes(asset));
console.log('Portable bundle: inline JavaScript syntax and embedded resources PASS');
