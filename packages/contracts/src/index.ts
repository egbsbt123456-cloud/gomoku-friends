export type GomokuSide='b'|'w';
export interface GomokuMove {x:number;y:number}
export interface GomokuState {board:(GomokuSide|null)[][];turn:GomokuSide;over:boolean;winner:GomokuSide|null;reason:string|null;version:number;moves:number;lastMove:GomokuMove|null;winningLine:GomokuMove[]}
export interface GomokuHistory {move:GomokuMove;mover:GomokuSide;notation:string;turnBefore:GomokuSide}
export interface GomokuRoomView {code:string;status:'waiting'|'playing'|'finished'|'cancelled';yourSide:GomokuSide;blackName:string;whiteName:string|null;state:GomokuState;history:GomokuHistory[];updatedAt:number}
