import { useContext } from "react";
import { ConfirmContext } from "../context/confirmContext";

// const confirm = useConfirm();
// if (!(await confirm({ title: "Delete?", message: "This cannot be undone.", confirmText: "Delete", tone: "danger" }))) return;
//
// Options: title, message, confirmText (default "Confirm"), cancelText (default "Cancel"), tone ("default" | "danger").
// Resolves true when confirmed, false when cancelled (Cancel, Esc or a click outside).
export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}
