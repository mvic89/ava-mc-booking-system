const DemoCard =({title,description,tag,tagColor,onClick}: {title: string; description: string;tag: string; tagColor: string; onClick: () => void;}) => {
  return (
    <button onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-5 text-left cursor-pointer transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]">
      <span className="inline-block text-white text-[10px] font-bold px-2 py-0.5 rounded-md mb-2"
        style={{ backgroundColor: tagColor }}>
        {tag}
      </span>
      <h3 className="text-[15px] font-bold mb-1">{title}</h3>
      <p className="text-sm text-slate-500 m-0">{description}</p>
    </button>
  );
}
 export default DemoCard;