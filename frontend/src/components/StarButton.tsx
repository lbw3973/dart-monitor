interface Props {
  marked: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
  className?: string;
}

export function StarButton({ marked, onToggle, size = "sm", className = "" }: Props) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={marked ? "저장 해제" : "저장"}
      aria-pressed={marked}
      className={`shrink-0 rounded transition ${size === "md" ? "text-base" : "text-xs"} ${
        marked
          ? "text-amber-500 hover:text-amber-600"
          : "text-slate-300 hover:text-amber-400 dark:text-slate-600"
      } ${className}`}
    >
      {marked ? "★" : "☆"}
    </button>
  );
}
