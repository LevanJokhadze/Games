import { useEffect, useState } from "react";

export const BOARDS = ["felt", "ocean", "wine", "night", "wood"] as const;
export const BACKS = ["red", "navy", "emerald", "gold"] as const;
export const DECKS = ["classic", "four"] as const;

export type Board = (typeof BOARDS)[number];
export type Back = (typeof BACKS)[number];
export type Deck = (typeof DECKS)[number];

export interface Theme {
  board: Board;
  back: Back;
  deck: Deck;
}

const KEY = "joker.theme";
const DEFAULT: Theme = { board: "felt", back: "red", deck: "classic" };

function load(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      board: BOARDS.includes(t.board) ? t.board : DEFAULT.board,
      back: BACKS.includes(t.back) ? t.back : DEFAULT.back,
      deck: DECKS.includes(t.deck) ? t.deck : DEFAULT.deck,
    };
  } catch {
    return DEFAULT;
  }
}

function apply(t: Theme) {
  const el = document.documentElement;
  el.dataset.board = t.board;
  el.dataset.back = t.back;
  el.dataset.deck = t.deck;
  const meta = document.querySelector('meta[name="theme-color"]');
  const colors: Record<Board, string> = { felt: "#0f3d2e", ocean: "#0d2c4a", wine: "#3a0f1c", night: "#15171c", wood: "#3b2414" };
  meta?.setAttribute("content", colors[t.board]);
}

export function useTheme(): [Theme, (t: Partial<Theme>) => void] {
  const [theme, setTheme] = useState<Theme>(load);
  useEffect(() => apply(theme), [theme]);
  const update = (p: Partial<Theme>) =>
    setTheme((prev) => {
      const next = { ...prev, ...p };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  return [theme, update];
}
