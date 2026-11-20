/* 15×15 自由五子棋。坐标 board[x][y]；不含禁手，连续至少五颗获胜。 */
(function(root){
  'use strict';
  var SIZE=15, directions=[[1,0],[0,1],[1,1],[1,-1]];
  function inside(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<SIZE&&y>=0&&y<SIZE;}
  function other(side){return side==='b'?'w':'b';}
  function initial(){return {board:Array.from({length:SIZE},function(){return Array(SIZE).fill(null);}),turn:'b',over:false,winner:null,reason:null,version:0,moves:0,lastMove:null,winningLine:[]};}
  function line(board,x,y,side){
    for(var d of directions){
      var run=[{x:x,y:y}];
      for(var sign of [-1,1]){
        for(var n=1;n<SIZE;n++){
          var nx=x+d[0]*n*sign,ny=y+d[1]*n*sign;
          if(!inside(nx,ny)||board[nx][ny]!==side)break;
          run.push({x:nx,y:ny});
        }
      }
      if(run.length>=5)return run;
    }
    return [];
  }
  function apply(state,side,move){
    if(!state||!Array.isArray(state.board)||state.board.length!==SIZE||!state.board.every(function(row){return Array.isArray(row)&&row.length===SIZE&&row.every(function(v){return v===null||v==='b'||v==='w';});})||!['b','w'].includes(state.turn)||!Number.isInteger(state.version)||state.version<0||!Number.isInteger(state.moves)||state.moves<0||state.moves>225)return {ok:false,code:'BAD_STATE'};
    if(state.over)return {ok:false,code:'GAME_OVER'};
    if(side!==state.turn)return {ok:false,code:'NOT_YOUR_TURN'};
    if(!move||!inside(move.x,move.y))return {ok:false,code:'BAD_COORDS'};
    if(state.board[move.x][move.y]!==null)return {ok:false,code:'OCCUPIED'};
    var board=state.board.map(function(row){return row.slice();});board[move.x][move.y]=side;
    var win=line(board,move.x,move.y,side),moves=state.moves+1,draw=!win.length&&moves===SIZE*SIZE;
    return {ok:true,state:{board:board,turn:other(side),over:win.length>0||draw,winner:win.length?side:null,reason:win.length?'five':draw?'draw':null,version:state.version+1,moves:moves,lastMove:{x:move.x,y:move.y},winningLine:win}};
  }
  function candidates(board){
    var found=new Set(),occupied=false;
    for(var x=0;x<SIZE;x++)for(var y=0;y<SIZE;y++)if(board[x][y]){
      occupied=true;
      for(var dx=-2;dx<=2;dx++)for(var dy=-2;dy<=2;dy++)if(inside(x+dx,y+dy)&&!board[x+dx][y+dy])found.add((x+dx)*SIZE+y+dy);
    }
    if(!occupied)return [{x:7,y:7}];
    return Array.from(found,function(n){return {x:Math.floor(n/SIZE),y:n%SIZE};});
  }
  function winsAt(board,m,side){
    board[m.x][m.y]=side;
    try{return line(board,m.x,m.y,side).length>0;}finally{board[m.x][m.y]=null;}
  }
  function value(board,m,side){
    var score=0,weights=[0,8,100,1800,40000,1000000];
    for(var d of directions){
      var count=1,open=0;
      for(var sign of [-1,1]){
        var n=1;
        while(inside(m.x+d[0]*n*sign,m.y+d[1]*n*sign)&&board[m.x+d[0]*n*sign][m.y+d[1]*n*sign]===side){count++;n++;}
        var nx=m.x+d[0]*n*sign,ny=m.y+d[1]*n*sign;
        if(inside(nx,ny)&&!board[nx][ny])open++;
      }
      if(open||count>=5)score+=weights[Math.min(count,5)]*(open===2?3:1);
    }
    return score;
  }
  function bestMove(state,side){
    if(!state||state.over||state.turn!==side)return null;
    var board=state.board.map(function(row){return row.slice();}),moves=candidates(board),enemy=other(side);
    for(var m of moves)if(winsAt(board,m,side))return m;
    for(var m of moves)if(winsAt(board,m,enemy))return m;
    var best=null,bestScore=-Infinity;
    for(var m of moves){
      var score=value(board,m,side)+value(board,m,enemy)*1.15-(Math.abs(m.x-7)+Math.abs(m.y-7));
      if(score>bestScore){bestScore=score;best=m;}
    }
    return best;
  }
  var api={createInitialState:initial,safeApplyMove:apply,bestMove:bestMove,winningLine:line};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.Gomoku=api;
})(typeof window!=='undefined'?window:globalThis);
