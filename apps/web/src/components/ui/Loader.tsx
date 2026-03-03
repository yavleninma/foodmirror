interface LoaderProps {
  text?: string;
}

export function Loader({ text = 'Загружаю…' }: LoaderProps) {
  return (
    <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-sm">
      <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
      <span>{text}</span>
    </div>
  );
}
