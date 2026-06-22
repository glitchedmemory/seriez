import Link from "next/link";
import { useTranslations } from "next-intl";

export default function Footer() {
  const t = useTranslations();

  const footerLinks = [
    { href: "/about", label: t("footer.about") },
    { href: "/pro", label: t("footer.goldenTicket") },
    { href: "/terms", label: t("footer.terms") },
    { href: "/privacy", label: t("footer.privacy") },
  ];
  return (
    <footer className="border-t border-border bg-bg-card mt-auto">
      <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col items-center gap-2">
        <nav aria-label="Legal">
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm">
            {footerLinks.map((link, i) => (
              <li key={link.href} className="flex items-center">
                <Link
                  href={link.href}
                  className="text-text-secondary hover:text-accent transition-colors"
                >
                  {link.label}
                </Link>
                {i < footerLinks.length - 1 && (
                  <span className="text-text-secondary ml-3 select-none" aria-hidden="true">
                    ·
                  </span>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-text-secondary text-xs">
          &copy; 2026 Seriez. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
