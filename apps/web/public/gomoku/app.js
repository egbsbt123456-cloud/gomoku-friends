(function(){
  'use strict';
  var E=window.Gomoku,mode=new URLSearchParams(window.location.search).get('mode')||'ai';
  if(!['ai','local','online'].includes(mode))mode='ai';
  var svg=document.getElementById('svg'),status=document.getElementById('status'),cells=[],mark=document.createElementNS('http://www.w3.org/2000/svg','rect');
  var state=E.createInitialState(),history=[],thinking=false,pending=false,side=null,ready=false,roomCode=null;
  var epoch=0,timer=null,watchdog=null,worker=null;
  function canPlay(){return !state.over&&!thinking&&!pending&&(mode==='local'||(mode==='ai'&&state.turn==='b')||(mode==='online'&&ready&&state.turn===side));}
  function parentMessage(type,data){window.parent.postMessage({channel:'boardgame:gomoku',type:type,data:data},window.location.origin);}
  function cellName(x,y){return String.fromCharCode(65+x)+(y+1);}
  for(let x=0;x<15;x++){
    cells[x]=[];
    for(let y=0;y<15;y++){
      var cell=document.createElementNS('http://www.w3.org/2000/svg','use');cells[x][y]=cell;
      cell.setAttribute('href','#piece');cell.setAttribute('x',x*10-70);cell.setAttribute('y',y*10-70);cell.setAttribute('fill-opacity','0');
      cell.setAttribute('data-x',x);cell.setAttribute('data-y',y);cell.setAttribute('aria-label',cellName(x,y));
      cell.addEventListener('mouseenter',function(){if(canPlay()&&!state.board[x][y]){cells[x][y].setAttribute('fill',state.turn==='b'?'url(#black)':'url(#white)');cells[x][y].setAttribute('fill-opacity','0.5');}});
      cell.addEventListener('mouseleave',function(){if(!state.board[x][y])cells[x][y].setAttribute('fill-opacity','0');});
      cell.addEventListener('click',function(){play({x:x,y:y});});svg.appendChild(cell);
    }
  }
  mark.setAttribute('fill','red');mark.setAttribute('width','2');mark.setAttribute('height','2');mark.setAttribute('opacity','0');mark.setAttribute('pointer-events','none');svg.appendChild(mark);
  function render(){
    for(var x=0;x<15;x++)for(var y=0;y<15;y++){
      var stone=state.board[x][y],cell=cells[x][y];cell.setAttribute('fill-opacity',stone?'1':'0');
      cell.setAttribute('fill',stone==='b'?'url(#black)':'url(#white)');
      cell.setAttribute('aria-label',cellName(x,y)+(stone?stone==='b'?'，黑棋':'，白棋':'，空位'));
    }
    mark.setAttribute('opacity',state.lastMove?'0.7':'0');
    if(state.lastMove){mark.setAttribute('x',state.lastMove.x*10-71);mark.setAttribute('y',state.lastMove.y*10-71);}
    status.classList.toggle('over',state.over);
    var text=state.over?(state.reason==='cancelled'?'房间已取消':state.winner?(state.winner==='b'?'黑棋':'白棋')+'获胜'+(state.reason==='resign'?' · 对方认输':''):'本局和棋'):thinking?'电脑思考中…':(state.turn==='b'?'黑棋':'白棋')+'行棋';
    if(mode==='online'&&!ready&&!state.over)text=roomCode?'等待好友加入':'等待房间同步…';
    status.textContent=text+' · 共 '+state.moves+' 手';
    document.getElementById('undo').disabled=!history.length||mode==='online';
  }
  function stopAI(){epoch++;clearTimeout(timer);clearTimeout(watchdog);if(worker)worker.terminate();worker=null;timer=null;watchdog=null;thinking=false;}
  function commit(move){
    var result=E.safeApplyMove(state,state.turn,move);if(!result.ok)return false;
    history.push({move:move,mover:state.turn,turnBefore:state.turn});state=result.state;render();return true;
  }
  function scheduleAI(){
    if(mode!=='ai'||state.over||state.turn!=='w')return;
    thinking=true;var id=++epoch,version=state.version;render();
    function current(){return id===epoch&&state.version===version&&!state.over&&state.turn==='w';}
    function finish(move){
      if(!current())return;
      clearTimeout(watchdog);if(worker)worker.terminate();worker=null;thinking=false;
      if(!move||!commit(move)){var fallback=E.bestMove(state,'w');if(fallback)commit(fallback);else render();}
    }
    function fallback(){if(current())finish(E.bestMove(state,'w'));}
    timer=setTimeout(function(){
      if(!current())return;
      try{
        if(typeof window.Worker!=='function'){fallback();return;}
        worker=new window.Worker('ai-worker.js?v=1');
        worker.onmessage=function(e){if(e.data.id!==id)return;if(e.data.error)fallback();else if(e.data.version===version)finish(e.data.move);};
        worker.onerror=function(e){if(e.preventDefault)e.preventDefault();fallback();};worker.onmessageerror=fallback;
        watchdog=setTimeout(fallback,1500);worker.postMessage({id:id,state:state});
      }catch(error){fallback();}
    },100);
  }
  function play(move){
    if(!canPlay())return;
    if(mode==='online'){
      if(!E.safeApplyMove(state,side,move).ok)return;
      pending=true;parentMessage('move',{move:move,expectedVersion:state.version});return;
    }
    if(commit(move))scheduleAI();
  }
  function reset(){if(mode==='online')return;stopAI();state=E.createInitialState();history=[];pending=false;render();}
  function undo(){
    if(mode==='online'||!history.length)return;stopAI();
    var steps=mode==='local'?1:state.turn==='w'?1:2;
    history=history.slice(0,Math.max(0,history.length-steps));state=E.createInitialState();
    for(var h of history)state=E.safeApplyMove(state,state.turn,h.move).state;
    render();
  }
  document.getElementById('newGame').addEventListener('click',reset);document.getElementById('undo').addEventListener('click',undo);
  document.getElementById('modeLabel').textContent=mode==='ai'?'人机对战 · 你执黑':mode==='local'?'本地双人 · 黑白轮流':'好友同玩';
  if(mode==='online'){
    document.getElementById('newGame').hidden=true;document.getElementById('undo').hidden=true;
    window.addEventListener('message',function(event){
      if(event.source!==window.parent||event.origin!==window.location.origin||event.data?.channel!=='boardgame:gomoku:control')return;
      var room=event.data.room;if(!room||!room.state||!Array.isArray(room.history))return;
      if(roomCode===room.code&&state.version>room.state.version)return;
      if(roomCode===room.code&&state.version===room.state.version&&!pending)return;
      roomCode=room.code;side=room.yourSide;ready=room.status==='playing';state=room.state;history=room.history;pending=false;render();
    });
    parentMessage('ready',{});
  }
  window.addEventListener('pagehide',stopAI);render();svg.setAttribute('data-ready','true');
  if(window.__GOMOKU_TEST_MODE__)window.__GOMOKU_TEST__={getState:function(){return state;},getHistory:function(){return history;},play:play,reset:reset,undo:undo};
})();
