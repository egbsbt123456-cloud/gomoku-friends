import {it,expect,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
class El{
 attrs:Record<string,string>={};children:El[]=[];events:Record<string,Function>={};hidden=false;disabled=false;textContent='';
 classList={toggle:(_name:string,_flag:boolean)=>{}};
 setAttribute(key:string,value:unknown){this.attrs[key]=String(value);}
 getAttribute(key:string){return this.attrs[key]??null;}
 addEventListener(name:string,fn:Function){this.events[name]=fn;}
 appendChild(child:El){this.children.push(child);return child;}
}
function setup(mode:string,Worker?:any){
 const els:Record<string,El>={};for(const id of ['svg','status','newGame','undo','modeLabel'])els[id]=new El();
 const messages:any[]=[],events:Record<string,Function>={};
 const ctx:any={URLSearchParams,console,setTimeout:(fn:Function,ms:number)=>setTimeout(fn,ms),clearTimeout:(id:any)=>clearTimeout(id),__GOMOKU_TEST_MODE__:true};
 ctx.window=ctx;ctx.location={search:`?mode=${mode}`,origin:'https://board.test'};ctx.parent={postMessage:(p:unknown)=>messages.push(p)};ctx.Worker=Worker;
 ctx.addEventListener=(name:string,fn:Function)=>events[name]=fn;
 ctx.document={getElementById:(id:string)=>els[id],createElementNS:()=>new El()};vm.createContext(ctx);
 for(const name of ['engine','app'])vm.runInContext(readFileSync(new URL(`../public/gomoku/${name}.js`,import.meta.url),'utf8'),ctx);
 const send=(room:unknown,origin=ctx.location.origin,source=ctx.parent)=>events.message?.({origin,source,data:{channel:'boardgame:gomoku:control',room}});
 return {game:ctx.__GOMOKU_TEST__,engine:ctx.Gomoku,els,messages,send};
}
afterEach(()=>vi.useRealTimers());
it('local two-player alternates, undoes one move, detects a middle five and locks the terminal board',()=>{
 const {game,els}=setup('local');game.play({x:7,y:7});game.play({x:8,y:7});expect(game.getState().turn).toBe('b');game.undo();expect(game.getState().turn).toBe('w');expect(game.getState().moves).toBe(1);game.reset();
 const line=[{x:3,y:3},{x:0,y:14},{x:4,y:3},{x:2,y:14},{x:6,y:3},{x:4,y:14},{x:7,y:3},{x:6,y:14},{x:5,y:3}];for(const move of line)game.play(move);
 expect(game.getState().winner).toBe('b');expect(els.status.textContent).toContain('黑棋获胜');game.play({x:8,y:14});expect(game.getState().moves).toBe(9);game.undo();expect(game.getState().over).toBe(false);
});
it('AI replies legally and resetting or undoing cancels a pending reply',()=>{
 vi.useFakeTimers();const {game}=setup('ai');game.play({x:7,y:7});game.play({x:8,y:7});expect(game.getState().moves).toBe(1);
 vi.advanceTimersByTime(100);expect(game.getState().moves).toBe(2);expect(game.getState().turn).toBe('b');game.undo();expect(game.getState().moves).toBe(0);
 game.play({x:7,y:7});game.reset();vi.advanceTimersByTime(200);expect(game.getState().moves).toBe(0);
 game.play({x:7,y:7});game.undo();vi.advanceTimersByTime(200);expect(game.getState().moves).toBe(0);
});
it('ignores old Worker results and falls back when Worker fails',()=>{
 vi.useFakeTimers();const workers:any[]=[];
 class Worker{onmessage:any;onerror:any;job:any;postMessage(job:any){this.job=job;workers.push(this);}terminate(){}}
 const {game}=setup('ai',Worker);game.play({x:7,y:7});vi.advanceTimersByTime(100);const old=workers[0];game.reset();old.onmessage({data:{id:old.job.id,version:old.job.state.version,move:{x:8,y:8}}});expect(game.getState().moves).toBe(0);
 game.play({x:7,y:7});vi.advanceTimersByTime(100);workers[1].onerror({preventDefault(){}});expect(game.getState().moves).toBe(2);expect(game.getState().turn).toBe('b');
});
it('online input is authorized by seat and only applies authoritative snapshots',()=>{
 const {game,engine,send,messages,els}=setup('online');let state=engine.createInitialState();state.version=1;
 const room={code:'0123456789',yourSide:'w',status:'playing',state,history:[]};
 game.play({x:7,y:7});expect(game.getState().moves).toBe(0);send(room,'https://evil.test');expect(els.status.textContent).toContain('等待房间同步');send(room);game.play({x:7,y:7});expect(messages).toHaveLength(1);
 state=engine.safeApplyMove(state,'b',{x:7,y:7}).state;send({...room,state,history:[]});game.play({x:8,y:7});expect(messages).toHaveLength(2);expect(messages[1].data.expectedVersion).toBe(2);expect(game.getState().moves).toBe(1);
 game.play({x:9,y:7});expect(messages).toHaveLength(2);const next=engine.safeApplyMove(state,'w',{x:8,y:7}).state;send({...room,state:next,history:[]});expect(game.getState().moves).toBe(2);send({...room,state,history:[]});expect(game.getState().moves).toBe(2);expect(els.newGame.hidden).toBe(true);
});
