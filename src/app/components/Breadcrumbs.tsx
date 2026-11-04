export default function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="text-xs text-slate-500 mb-4 flex items-center space-x-2">
      <a href="/dashboard" className="hover:text-[#0046ff]">ホーム</a>
      {items.map((item, index) => (
        <span key={index} className="flex items-center space-x-2">
          <span>/</span>
          {item.href ? (
            <a href={item.href} className="hover:text-[#0046ff]">{item.label}</a>
          ) : (
            <span className="text-slate-800 font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}