import Link from "next/link";

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 16V4M12 4l-4 4M12 4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
      />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-6 w-6"
    >
      <rect x="1" y="7" width="13" height="10" rx="1" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 10h4l4 4v3h-8v-7Z"
      />
      <circle cx="6" cy="19" r="1.75" />
      <circle cx="17.5" cy="19" r="1.75" />
    </svg>
  );
}

const UPLOAD_TYPES = [
  {
    href: "/upload/kpi",
    icon: UploadIcon,
    label: "Standardní KPI data",
    description:
      "Měsíční čísla, co už firma sama spočítala (zmetkovitost, OEE, stav zásob...)",
  },
  {
    href: "/upload/deliveries",
    icon: TruckIcon,
    label: "Report dodávek (OTIF)",
    description:
      "Syrová data o zakázkách (slíbený/reálný termín a množství) — OTIF si appka spočítá sama",
  },
];

export default function UploadChooserPage() {
  return (
    <div className="mx-auto max-w-2xl px-8 py-16 font-sans">
      <h1 className="mb-2 text-2xl font-semibold">Nahrát data</h1>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Vyber, jaký typ dat nahráváš.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {UPLOAD_TYPES.map(({ href, icon: Icon, label, description }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-start gap-2 rounded-lg border border-zinc-200 bg-white p-5 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <Icon />
            <span className="font-medium text-black dark:text-zinc-50">
              {label}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {description}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
