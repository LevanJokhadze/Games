import type { Card, Suit } from "../types";

export const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
export const RANK_LABEL: Record<number, string> = { 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A" };
export const isRed = (s: Suit | null) => s === "H" || s === "D";

interface Props {
  card: Card;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  selected?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  label?: string;
}

export function CardView({ card, size = "md", disabled, selected, onClick, style, label }: Props) {
  const cls = ["card", `card-${size}`];
  if (card.joker) cls.push("card-joker");
  else if (isRed(card.suit)) cls.push("card-red");
  if (disabled) cls.push("card-disabled");
  if (selected) cls.push("card-selected");
  if (onClick) cls.push("card-clickable");
  const name = card.joker ? "Joker" : `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit!]}`;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag className={cls.join(" ")} style={style} onClick={onClick} aria-label={label ?? name} disabled={onClick ? disabled : undefined} type={onClick ? "button" : undefined}>
      {card.joker ? (
        <>
          <span className="card-corner">★</span>
          <span className="joker-star">★</span>
          <span className="joker-word">JOKER</span>
        </>
      ) : (
        <>
          <span className="card-corner">
            <span>{RANK_LABEL[card.rank]}</span>
            <span>{SUIT_SYMBOL[card.suit!]}</span>
          </span>
          <span className="card-pip">{SUIT_SYMBOL[card.suit!]}</span>
        </>
      )}
    </Tag>
  );
}

export function CardBack({ size = "sm", style }: { size?: "sm" | "md"; style?: React.CSSProperties }) {
  return <div className={`card card-${size} card-back`} style={style} aria-hidden />;
}

export function SuitBadge({ suit, className }: { suit: Suit | null; className?: string }) {
  if (!suit) return <span className={`suit-badge ${className ?? ""}`}>∅</span>;
  return <span className={`suit-badge ${isRed(suit) ? "red" : ""} ${className ?? ""}`}>{SUIT_SYMBOL[suit]}</span>;
}
