"use client";

import { createContext, useContext } from "react";

const BotContext = createContext(false);

export function BotProvider({
  isBot,
  children,
}: {
  isBot: boolean;
  children: React.ReactNode;
}) {
  return <BotContext.Provider value={isBot}>{children}</BotContext.Provider>;
}

export function useIsBot(): boolean {
  return useContext(BotContext);
}
