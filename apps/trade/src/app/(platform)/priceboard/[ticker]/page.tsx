export default function TickerPage({ params }: { params: { ticker: string } }) {
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
        {params.ticker}
      </h1>
      <p style={{ color: 'var(--muted)' }}>Chi tiết cổ phiếu — Coming soon</p>
    </div>
  );
}
