import {it,expect} from 'vitest';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {openDatabase,migrate} from '../database/index.js';
import {createApp} from '../app.js';
const origin='https://board.test';
const headers=(user:string)=>({origin,cookie:`board_session=${user}`});
const redMove={x:7,y:7},blackMove={x:8,y:7};
it('authenticates rooms, serializes joins and moves, rejects forgery, survives restart and ends by resignation',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'board-gomoku-')),path=join(dir,'db.sqlite');
 const data=openDatabase(path);migrate(data.sqlite);
 for(const user of ['alice','bob','carol']){
  data.sqlite.prepare('INSERT INTO users(id,username,nickname,password_hash,created_at) VALUES(?,?,?,?,?)').run(user,user,user,'unused',Date.now());
  data.sqlite.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(user).digest('hex'),user,Date.now()+60000);
 }data.sqlite.close();
 let app=createApp({databasePath:path,origin,production:true,logger:false}).app;
 const post=(url:string,user:string,payload:object)=>app.inject({method:'POST',url,headers:headers(user),payload});
 const cmd=(type:string,expectedVersion:number,move?:object,requestId=randomUUID())=>({type,expectedVersion,requestId,...(move?{move}:{})});
 try{
  expect((await app.inject('/api/gomoku/rooms')).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:'/api/gomoku/rooms',headers:{...headers('alice'),origin:'https://evil.test'},payload:{}})).statusCode).toBe(403);
  const created=await post('/api/gomoku/rooms','alice',{});expect(created.statusCode).toBe(201);const room=created.json(),base=`/api/gomoku/rooms/${room.code}`;
  expect(room.status).toBe('waiting');expect(room.yourSide).toBe('b');expect(JSON.stringify(room)).not.toContain('black_id');
  expect((await post(base+'/actions','alice',cmd('move',0,redMove))).statusCode).toBe(409);
  expect((await app.inject({url:base,headers:headers('bob')})).statusCode).toBe(404);
  expect((await post(base+'/join','alice',{})).json().yourSide).toBe('b');
  const joins=await Promise.all([post(base+'/join','bob',{}),post(base+'/join','carol',{})]);
  expect(joins.map(r=>r.statusCode).sort()).toEqual([200,409]);const black=joins[0]!.statusCode===200?'bob':'carol',third=black==='bob'?'carol':'bob';
  expect((await post(base+'/join',black,{})).json().yourSide).toBe('w');
  expect((await app.inject({url:base,headers:headers(third)})).statusCode).toBe(404);
  expect((await post(base+'/actions',third,cmd('resign',1))).statusCode).toBe(404);
  expect((await post(base+'/actions',black,cmd('move',1,blackMove))).statusCode).toBe(409);
  expect((await post(base+'/actions','alice',cmd('move',1,{x:15,y:7}))).statusCode).toBe(400);
  expect((await post(base+'/actions','alice',{...cmd('move',1,redMove),board:[]})).statusCode).toBe(400);
  const first=cmd('move',1,redMove);const response=await post(base+'/actions','alice',first);expect(response.statusCode).toBe(200);expect(response.json().state.version).toBe(2);
  expect((await post(base+'/actions','alice',first)).json().history).toHaveLength(1);
  expect((await post(base+'/actions','alice',{...first,move:{...redMove,x:1}})).statusCode).toBe(409);
  expect((await post(base+'/actions',black,cmd('move',1,blackMove))).statusCode).toBe(409);
  const second=await post(base+'/actions',black,cmd('move',2,blackMove));expect(second.statusCode).toBe(200);expect(second.json().history).toHaveLength(2);
  expect((await post(base+'/actions','alice',first)).json().history).toHaveLength(2);
  expect((await post(base+'/actions','alice',cmd('cancel',3))).statusCode).toBe(409);
  await app.close();app=createApp({databasePath:path,origin,production:true,logger:false}).app;
  const saved=(await app.inject({url:base,headers:headers('alice')})).json();expect(saved.state.version).toBe(3);expect(saved.state.board[8][7]).toBe('w');expect(saved.history).toHaveLength(2);
  expect((await app.inject({url:'/api/gomoku/rooms',headers:headers(black)})).json().rooms).toHaveLength(1);
  const end=cmd('resign',3);const ended=await post(base+'/actions',black,end);expect(ended.json().state.winner).toBe('b');expect(ended.json().status).toBe('finished');
  expect((await post(base+'/actions',black,end)).statusCode).toBe(200);
  expect((await post(base+'/actions','alice',cmd('move',4,{x:7,y:8}))).statusCode).toBe(409);
  const nextRoom=(await post('/api/gomoku/rooms','alice',{})).json();const path2=`/api/gomoku/rooms/${nextRoom.code}`;
  await post(path2+'/join',black,{});let version=1;
  const line=[{x:3,y:3},{x:0,y:14},{x:4,y:3},{x:2,y:14},{x:6,y:3},{x:4,y:14},{x:7,y:3},{x:6,y:14},{x:5,y:3}];
  for(let i=0;i<line.length;i++){const result=await post(path2+'/actions',i%2===0?'alice':black,cmd('move',version++,line[i]));expect(result.statusCode).toBe(200);if(i===8){expect(result.json().status).toBe('finished');expect(result.json().state.winner).toBe('b');}}
  expect((await post(path2+'/actions',black,cmd('move',version,{x:8,y:14}))).statusCode).toBe(409);
  const pending=(await post('/api/gomoku/rooms','alice',{})).json();const cancelled=await post(`/api/gomoku/rooms/${pending.code}/actions`,'alice',cmd('cancel',0));expect(cancelled.json().status).toBe('cancelled');
  expect((await post(`/api/gomoku/rooms/${pending.code}/join`,black,{})).statusCode).toBe(409);
  const check=openDatabase(path);check.sqlite.prepare("UPDATE users SET status='disabled' WHERE id='alice'").run();check.sqlite.close();
  expect((await app.inject({url:base,headers:headers('alice')})).statusCode).toBe(401);
 }finally{await app.close();if(dirname(dir)===tmpdir()&&basename(dir).startsWith('board-gomoku-'))rmSync(dir,{recursive:true,force:true});}
});
it('does not open friend rooms on production HTTP',async()=>{
 const {app}=createApp({databasePath:':memory:',origin:'http://board.test',production:true,logger:false});
 try{expect((await app.inject('/api/gomoku/rooms')).statusCode).toBe(503);}finally{await app.close();}
});
