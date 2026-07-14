"use client";

import { useState, useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";

interface Props {
  children: React.ReactNode;
  serverLocale: string;
  serverMessages: Record<string, any>;
  allMessages: Record<string, Record<string, any>>;
}

export default function LocaleProvider({ children, serverLocale, serverMessages, allMessages }: Props) {
  const [locale, setLocale] = useState(serverLocale);
  const [messages, setMessages] = useState(serverMessages);

  useEffect(() => {
    const match = document.cookie.match(/(?:^|;\s*)SERIEZ_LOCALE=([^;]+)/);
    const cookieLocale = match?.[1];
    if (cookieLocale && cookieLocale !== serverLocale && allMessages[cookieLocale]) {
      setLocale(cookieLocale);
      setMessages(allMessages[cookieLocale]);
    }
  }, []);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
