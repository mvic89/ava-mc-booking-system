const Field = ({ label, value, source }: { label: string; value: string; source: string }) => {
  const sourceColors: Record<string, string> = {
    BankID: '#2563eb',
    Personnummer: '#8b5cf6',
    Device: '#64748b',
    'Roaring.io': '#f97316',
  };
  return (
    <div className="mb-1">
      <span className="text-[11px] text-slate-400">{label}: </span>
      <span className="text-sm font-semibold">{value}</span>
      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded ml-1.5"
        style={{
          color: sourceColors[source] || '#64748b',
          background: `${sourceColors[source] || '#64748b'}15`,
        }}
      >
        {source}
      </span>
    </div>
  );
}

export default Field;