export default function SpikeSets({ spikes, onPick }) {
  if (!spikes) return null;
  const Item = ({x}) => (
    <div className="flex justify-between py-1 text-sm">
      <button onClick={()=>onPick?.(x.symbol)} className="font-medium hover:underline">
        {x.nameKr} <span className="text-gray-500">({x.symbol.replace("KRW-","")})</span>
      </button>
      <div className="text-right">
        <div>{x.state}</div>
        <div className="text-xs text-gray-500">
          변동 {x.changePct}% · 거래량 {x.volRatio}x
        </div>
      </div>
    </div>
  );

  return (
    <div className="grid md:grid-cols-2 gap-3 mt-3">
      <div className="rounded-xl border p-3 shadow-sm">
        <div className="font-bold mb-1">🔥 급등 한세트</div>
        {spikes.up?.length ? spikes.up.map((x,i)=><Item key={i} x={x}/>) : <div className="text-sm text-gray-500">없음</div>}
      </div>
      <div className="rounded-xl border p-3 shadow-sm">
        <div className="font-bold mb-1">⚠️ 급락 한세트</div>
        {spikes.down?.length ? spikes.down.map((x,i)=><Item key={i} x={x}/>) : <div className="text-sm text-gray-500">없음</div>}
      </div>
    </div>
  );
}
