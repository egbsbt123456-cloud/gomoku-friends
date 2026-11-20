import {it,expect} from 'vitest';
import {gomokuEngine as E} from '@board/game-core';
import type {GomokuState} from '@board/contracts';
import {readFileSync} from 'node:fs';
it('uses exactly the browser rule source on the server',()=>{
 expect(readFileSync(new URL('../../../../packages/game-core/src/gomoku-engine.cjs',import.meta.url),'utf8')).toBe(readFileSync(new URL('../../../web/public/gomoku/engine.js',import.meta.url),'utf8'));
});
it.each([[1,0],[0,1],[1,1],[1,-1]])('detects a five completed in the middle in direction %s/%s',(dx,dy)=>{
 const s=E.createInitialState();for(const n of [-2,-1,1,2])s.board[7+dx*n]![7+dy*n]='b';s.moves=4;
 const before=JSON.stringify(s);const result=E.safeApplyMove(s,'b',{x:7,y:7});
 expect(result.ok).toBe(true);if(!result.ok)return;expect(result.state.winner).toBe('b');expect(result.state.winningLine).toHaveLength(5);expect(JSON.stringify(s)).toBe(before);
 expect(E.safeApplyMove(result.state,'w',{x:0,y:0})).toMatchObject({ok:false,code:'GAME_OVER'});
});
it('accepts a long line and detects a full-board draw',()=>{
 const long=E.createInitialState();for(const x of [2,3,4,6,7])long.board[x]![7]='b';long.moves=5;
 const result=E.safeApplyMove(long,'b',{x:5,y:7});expect(result.ok&&result.state.winningLine.length).toBe(6);
 const draw=E.createInitialState();for(let x=0;x<15;x++)for(let y=0;y<15;y++)draw.board[x]![y]=(x+2*y+3)%4<2?'b':'w';
 draw.board[14]![14]=null;draw.moves=224;
 const ended=E.safeApplyMove(draw,'b',{x:14,y:14});expect(ended.ok&&ended.state.reason).toBe('draw');expect(ended.ok&&ended.state.winner).toBe(null);
});
it('rejects wrong actors, duplicate/fractional/out-of-range coordinates and malformed state',()=>{
 const s=E.createInitialState();expect(E.safeApplyMove(s,'w',{x:7,y:7})).toMatchObject({ok:false,code:'NOT_YOUR_TURN'});
 for(const m of [{x:-1,y:7},{x:7.5,y:7},{x:15,y:7},{x:7,y:15}])expect(E.safeApplyMove(s,'b',m)).toMatchObject({ok:false,code:'BAD_COORDS'});
 const first=E.safeApplyMove(s,'b',{x:7,y:7});if(!first.ok)throw Error('Initial move failed');
 expect(E.safeApplyMove(first.state,'w',{x:7,y:7})).toMatchObject({ok:false,code:'OCCUPIED'});
 expect(E.safeApplyMove({...s,board:null} as unknown as GomokuState,'b',{x:7,y:7})).toMatchObject({ok:false,code:'BAD_STATE'});
});
it('AI chooses a winning move before defence, blocks a forced four and leaves its input unchanged',()=>{
 const s=E.createInitialState();s.turn='w';for(let x=3;x<=6;x++)s.board[x]![7]='w';s.moves=4;
 const before=JSON.stringify(s),win=E.bestMove(s,'w');expect(win).not.toBeNull();const won=E.safeApplyMove(s,'w',win!);expect(won.ok&&won.state.winner).toBe('w');expect(JSON.stringify(s)).toBe(before);
 for(let x=3;x<=6;x++)s.board[x]![7]='b';s.board[2]![7]='w';s.moves=5;
 expect(E.bestMove(s,'w')).toEqual({x:7,y:7});expect(E.bestMove({...s,over:true},'w')).toBe(null);
});
it('AI always produces legal moves until the game finishes',()=>{
 let state=E.createInitialState();
 for(let n=0;n<225&&!state.over;n++){
  const move=E.bestMove(state,state.turn);expect(move).not.toBeNull();const next=E.safeApplyMove(state,state.turn,move!);if(!next.ok)throw Error(next.code);state=next.state;
 }
 expect(state.over).toBe(true);expect(state.moves).toBeLessThanOrEqual(225);
});
