"use client";

const ICONS: Record<string, string> = {
  watched: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M14 24l6 6 14-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  watching: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="1.5"/>
    <circle cx="24" cy="24" r="4" fill="currentColor"/>
    <path d="M6 24C10 14 18 8 24 8s14 6 18 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M42 24C38 34 30 40 24 40s-14-6-18-16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  towatch: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 16h36" stroke="currentColor" stroke-width="1.5"/>
    <path d="M30 28l-8 5V23l8 5z" fill="currentColor"/>
  </svg>`,
  collections: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/>
    <rect x="26" y="6" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/>
    <rect x="6" y="26" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/>
    <rect x="26" y="26" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.5"/>
  </svg>`,
  signin: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="18" cy="16" r="6" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 40c0-8.837 5.373-16 12-16s12 7.163 12 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  empty: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="12" width="32" height="28" rx="3" stroke="currentColor" stroke-width="1.5"/>
    <path d="M8 18h32" stroke="currentColor" stroke-width="1.5"/>
    <path d="M20 28h8M24 24v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
  noitems: `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="8" width="36" height="32" rx="3" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6 24h36" stroke="currentColor" stroke-width="1.5"/>
    <path d="M17 6l4 16m6-16l-4 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`,
};

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  const svg = ICONS[icon];
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#6366f1]/10 to-[#a855f7]/5 border border-white/[0.06] flex items-center justify-center mb-5 backdrop-blur-sm"
        style={{ boxShadow: "0 0 40px -10px rgba(99,102,241,0.15)" }}
      >
        {svg ? (
          <span
            className="text-[#818cf8]"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <span className="text-4xl">{icon}</span>
        )}
      </div>
      <p className="text-text-primary font-semibold mb-1.5 text-[15px] tracking-tight">{title}</p>
      {description && (
        <p className="text-[13px] text-text-secondary/70 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <a
          href={action.href}
          className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-white/5 text-text-primary text-sm font-medium hover:bg-white/10 transition-colors border border-white/[0.08]"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
