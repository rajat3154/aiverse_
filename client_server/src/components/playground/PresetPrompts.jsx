// Starter prompts shown on an empty chat; picking one sends it straight away.
export default function PresetPrompts({ prompts, onSelect, title = "Try it out", description, disabled, isLight }) {
  return (
    <div className="mt-4 flex flex-col items-center gap-3 text-center">
      <p className="m-0 text-[14px] font-semibold">{title}</p>
      {description && <p className={`m-0 text-[13px] leading-snug ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>{description}</p>}
      <div className="flex flex-col gap-2 self-stretch">
        {prompts.map((text) => (
          <button
            key={text}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(text)}
            className={`cursor-pointer border bg-transparent px-3 py-2 text-left text-[13px] transition-colors hover:border-(--accent-color) disabled:cursor-not-allowed disabled:opacity-50 ${
              isLight ? "border-[#E5E4E7] text-gray-700" : "border-[#263241] text-[#B8C4D0]"
            }`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}
