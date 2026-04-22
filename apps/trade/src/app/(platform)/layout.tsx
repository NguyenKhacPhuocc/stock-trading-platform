export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      {/* Sidebar sẽ thêm sau */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar sẽ thêm sau */}
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
