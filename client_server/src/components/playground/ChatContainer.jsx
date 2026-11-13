import { useEffect, useRef } from "react";

// Chat layout: optional header, a scrolling message list that sticks to the bottom, and the input underneath.
export default function ChatContainer({ header, input, children, isLight }) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });
  const line = isLight ? "border-[#E5E4E7]" : "border-[#263241]/60";
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header && <div className={`shrink-0 border-b px-5 py-3 ${line}`}>{header}</div>}
      <div ref={scrollRef} className="scrollable flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
        {children}
      </div>
      <div className={`shrink-0 border-t px-5 py-3 ${line}`}>{input}</div>
    </div>
  );
}
