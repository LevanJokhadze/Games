// Mirrors the room view sent by the GamesBack worker.
export type Suit = "S" | "H" | "D" | "C";

export interface Card {
  id: string;
  suit: Suit | null;
  rank: number;
  joker: boolean;
}

export type JokerMode = { type: "high" | "low"; suit?: Suit };

export interface Play {
  seat: number;
  card: Card;
  joker?: JokerMode;
}

export interface DealResult {
  handSize: number;
  bids: number[];
  took: number[];
  points: number[];
}

export interface PulkaResult {
  deals: DealResult[];
  premium: number[];
  bonus: number[];
  total: number[];
}

export interface GameView {
  phase: "trump" | "bidding" | "playing" | "gameOver";
  schedule: number[][];
  pulka: number;
  dealInPulka: number;
  handSize: number;
  dealer: number;
  turn: number;
  trump: Suit | null;
  trumpCard: Card | null;
  bids: (number | null)[];
  took: number[];
  trick: Play[];
  lastTrick: { plays: Play[]; winner: number } | null;
  pulkas: PulkaResult[];
  totals: number[];
  handCounts: number[];
  hand: Card[];
  legalCards: string[];
  legalBids: number[];
  forbiddenBid: number | null;
}

export interface SeatView {
  name: string;
  bot: boolean;
  connected: boolean;
  host: boolean;
  you: boolean;
}

export interface GameConfig {
  mode: "standard" | "nines";
  khishti: number;
}

export interface RoomView {
  code: string;
  status: "lobby" | "playing" | "finished";
  isHost: boolean;
  you: number | null;
  config: GameConfig;
  deadline: number | null;
  serverTime: number;
  chat: { seat: number | null; name: string; text: string; at: number }[];
  seats: (SeatView | null)[];
  game: GameView | null;
}
