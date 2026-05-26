type AccountPagePlaceholderProps = {
  title: string;
  description: string;
};

export function AccountPagePlaceholder({
  title,
  description,
}: AccountPagePlaceholderProps) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 rounded-md border border-border bg-[#0b0d11] p-6 text-center">
      <h1 className="text-[13px] font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}
