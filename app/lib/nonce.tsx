import { createContext, useContext, type PropsWithChildren } from "react";

/**
 * The nonce of the response being rendered. The server (entry.server.tsx) wraps the render in the provider; in the browser there is no provider
 * and the value is undefined: the scripts have run by then, and the browser hides a nonce from the DOM anyway, so a React prop of `undefined`
 * costs nothing at hydration.
 */
const NonceContext = createContext<string | undefined>(undefined);

export function NonceProvider({ nonce, children }: PropsWithChildren<{ nonce: string }>) {
  return <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>;
}

export function useNonce(): string | undefined {
  return useContext(NonceContext);
}
