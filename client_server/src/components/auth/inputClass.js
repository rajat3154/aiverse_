export const inputClass = (hasError, light) =>
  `w-full min-w-0 border px-3.5 py-3 text-base outline-none sm:py-2.5 sm:text-sm transition focus:border-(--accent-color) focus:ring-2 focus:ring-(--accent-soft) ${
    light ? "bg-white text-gray-900 placeholder:text-gray-400" : "bg-[#0B1220] text-white placeholder:text-[#5B6B7E]"
  } ${hasError ? "border-red-500/70" : light ? "border-[#E5E4E7]" : "border-[#263241]"}`;
