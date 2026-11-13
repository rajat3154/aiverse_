import { useCallback, useEffect, useRef, useState } from "react";
import { ConfirmContext } from "../../context/confirmContext";
import { useTheme } from "../../context/ThemeContext";

// One themed confirmation dialog for the whole app. Wrap the app once (inside ThemeProvider) and call useConfirm() anywhere.
function ConfirmDialog({ options, onResult }) {
  const { mainSectionTheme } = useTheme();
  const isLight = mainSectionTheme === "light";
  const { title = "Are you sure?", message, confirmText = "Confirm", cancelText = "Cancel", tone = "default" } = options;
  const danger = tone === "danger";
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onResult(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onResult]);

  const btn = "cursor-pointer px-4 py-2 text-[13.5px] font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-(--accent-color)";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/60" onClick={() => onResult(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? "confirm-message" : undefined}
        className={`relative w-full max-w-sm border p-5 shadow-2xl ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241] bg-black text-white"}`}
      >
        <span className={`absolute inset-x-0 top-0 h-0.5 ${danger ? "bg-rose-500" : ""}`} style={danger ? undefined : { backgroundImage: "var(--accent-paint)" }} aria-hidden="true" />
        <h2 id="confirm-title" className="m-0 text-[16px] font-semibold">{title}</h2>
        {message && <p id="confirm-message" className={`m-0 mt-2 text-[13.5px] leading-snug ${isLight ? "text-gray-600" : "text-[#AEBBCB]"}`}>{message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onResult(false)}
            className={`${btn} border bg-transparent ${isLight ? "border-[#E5E4E7] text-gray-900 hover:bg-black/4" : "border-[#263241] text-white hover:bg-white/6"}`}
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onResult(true)}
            className={`${btn} border-0 hover:opacity-90 ${danger ? "bg-rose-500 text-white" : "text-black"}`}
            style={danger ? undefined : { backgroundImage: "var(--accent-paint)" }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmProvider({ children }) {
  const [pending, setPending] = useState(null); // { options, resolve }

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        // a second request while one is open cancels the first
        setPending((current) => {
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    []
  );

  const onResult = useCallback((value) => {
    setPending((current) => {
      current?.resolve(value);
      return null;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && <ConfirmDialog options={pending.options} onResult={onResult} />}
    </ConfirmContext.Provider>
  );
}
