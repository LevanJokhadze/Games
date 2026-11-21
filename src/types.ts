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
  kind?: "joker";
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

export interface Profile {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  rating: number;
  games: number;
  wins: number;
  peak: number;
  avatarUrl: string;
  /** Can log in with nickname + password on another device. */
  hasPassword?: boolean;
}

export interface RatingChange {
  before: number;
  after: number;
  delta: number;
}

export interface SeatView {
  name: string;
  avatarUrl: string | null;
  rating: number | null;
  userId: string | null;
  bot: boolean;
  connected: boolean;
  host: boolean;
  you: boolean;
  /** A bot is playing for them; they are removed from the match at this time unless they come back. */
  afkKickAt: number | null;
  /** Removed from the match for not coming back; a bot plays the seat. */
  left: boolean;
}

/** Server notice in the chat. */
export interface SysNotice {
  kind: "warn" | "afk" | "back" | "kicked";
  name: string;
  penalty?: number;
}

export interface ChatLine {
  seat: number | null;
  name: string;
  text: string;
  at: number;
  sys?: SysNotice;
}

export type GameKind = "joker" | "bura";

export interface GameConfig {
  /** Which card game the room plays (older rooms: Joker). */
  game?: GameKind;
  mode: "standard" | "nines";
  khishti: number;
  /** Partners sit opposite: seats 0 & 2 against 1 & 3. */
  pairs: boolean;
}

export interface RoomView {
  code: string;
  status: "lobby" | "playing" | "finished";
  isHost: boolean;
  you: number | null;
  config: GameConfig;
  deadline: number | null;
  /** "warn" while the player to act is in their extra minute. */
  turnStage: "turn" | "warn";
  serverTime: number;
  chat: ChatLine[];
  seats: (SeatView | null)[];
  game: GameView | BuraView | null;
  ratingChanges: (RatingChange | null)[] | null;
  matchId: string | null;
  accounts: boolean;
  /** Your public id among `people`. */
  peer: string;
  /** Everyone connected: players and spectators. */
  people: Person[];
}

export interface Person {
  peer: string;
  name: string;
  avatarUrl: string | null;
  /** null = watching */
  seat: number | null;
  /** Joined the voice chat. */
  voice: boolean;
}

export interface GameRecord {
  id: string;
  finishedAt: string;
  /** "offline" = played in person and written on a score sheet. */
  source?: string;
  mode: string;
  pairs: boolean;
  score: number;
  place: number;
  ratingBefore: number;
  ratingAfter: number;
  players: { name: string; userId: string | null; score: number; place: number }[];
}

export interface MatchPlayer {
  seat: number;
  name: string;
  userId: string | null;
  bot: boolean;
  avatarUrl: string | null;
  score: number;
  place: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

export interface Match {
  id: string;
  finishedAt: string;
  source?: string;
  mode: string;
  khishti: number;
  pairs: boolean;
  players: MatchPlayer[];
  pulkas: PulkaResult[];
}

// ---------- Bura (5 cards, in pairs) ----------

export interface BuraPlay {
  seat: number;
  /** null = a face-down card you can't see. */
  cards: (Card | null)[];
  up: boolean[];
}

export interface BuraRaise {
  by: number;
  leader: number;
  to: number;
  stage: "partner" | "answer" | "answerPartner";
  answerer: number | null;
  answer: "raise" | "fold" | null;
}

export interface BuraRound {
  dealer: number;
  trump: Suit;
  points: [number, number] | null;
  winner: number | null;
  value: number;
  stake: number;
  how: "points" | "tie" | "bura" | "fold";
  seat: number | null;
  bura: Card[] | null;
  match: [number, number];
}

export interface BuraView {
  kind: "bura";
  phase: "playing" | "roundOver" | "gameOver";
  round: number;
  target: number;
  match: [number, number];
  cut: Card | null;
  dealer: number;
  turn: number;
  trump: Suit;
  trumpCard: Card | null;
  stockCount: number;
  handCounts: number[];
  hand: Card[];
  pileCounts: [number, number];
  trick: { leader: number; size: number; best: number; malyutka: number | null; topUps: number[]; plays: BuraPlay[] } | null;
  lastTrick: { winner: number; plays: BuraPlay[] } | null;
  stake: number;
  lastRaiseTeam: number | null;
  raise: BuraRaise | null;
  crawford: boolean;
  rounds: BuraRound[];
  need: "lead" | "answer" | "topUp" | "approve" | "respond" | null;
  cardsNeeded: number;
  canRaise: boolean;
  canBura: boolean;
  canMalyutka: boolean;
  canRaiseAgain: boolean;
}

/** One deal on an in-person score sheet; `took` is null while the deal is being played. */
export interface SheetDeal {
  bids: number[];
  took: number[] | null;
}

export interface SheetPlayer {
  id: string;
  nickname: string;
  firstName: string;
  lastName: string;
  rating: number;
  avatarUrl: string;
}

/** Score sheet of a Joker game played in person with real cards. */
export interface Sheet {
  id: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: "recording" | "pending" | "rated" | "cancelled";
  config: GameConfig;
  players: SheetPlayer[];
  firstDealer: number;
  deals: SheetDeal[];
  confirmed: string[];
  rejected: { userId: string; at: string } | null;
  matchId: string | null;
  ratingChanges: (RatingChange | null)[] | null;
  score: { schedule: number[][]; pulkas: PulkaResult[]; totals: number[]; done: number; count: number; complete: boolean };
  /** Dealer of the next deal to write, -1 when all deals are written. */
  dealer: number;
  you: number | null;
  canEdit: boolean;
  mustConfirm: boolean;
}
