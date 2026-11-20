import type {GomokuState,GomokuSide,GomokuMove} from '@board/contracts';
declare const engine:{createInitialState():GomokuState;safeApplyMove(state:GomokuState,side:GomokuSide,move:GomokuMove):{ok:true;state:GomokuState}|{ok:false;code:string};bestMove(state:GomokuState,side:GomokuSide):GomokuMove|null};
export = engine;
