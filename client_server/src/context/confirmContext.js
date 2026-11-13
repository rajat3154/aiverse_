import { createContext } from "react";

// Holds the confirm() function supplied by <ConfirmProvider>. Use it through the useConfirm hook.
export const ConfirmContext = createContext(null);
