'use strict';
importScripts('engine.js');
self.onmessage=function(event){
  var job=event.data;
  try{self.postMessage({id:job.id,version:job.state.version,move:self.Gomoku.bestMove(job.state,'w')});}
  catch(error){self.postMessage({id:job.id,error:true});}
};
