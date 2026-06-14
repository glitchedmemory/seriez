"use client";

interface Props {
  icon: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}

export default function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-20 h-20 rounded-full bg-bg-card border border-border flex items-center justify-center mb-4">
        <span className="text-3xl">{icon}</span>
      </div>
      <p className="text-white font-semibold mb-1 text-base">{title}</p>
      {description && (
        <p className="text-sm text-text-secondary max-w-xs leading-relaxed">{description}</p>
      )}
      {action && (
        <a
          href={action.href}
          className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-[#818cf8] transition-colors shadow-lg shadow-[#6366f1]/20"
        >
          {action.label}
        </a>
      )}
    </div>
  );
}
