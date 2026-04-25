"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HighContrastToggle } from "./HighContrastToggle";

export function Nav() {
  const pathname = usePathname();
  const links = [
    { href: "/", label: "Home" },
    { href: "/planner", label: "Day Planner" },
    { href: "/why-this-matters", label: "Why This Matters" },
  ];

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur hc:border-black hc:bg-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 hc:focus:bg-black focus:text-white focus:rounded"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-indigo-700 ring-1 ring-indigo-100 hc:bg-white hc:text-black hc:ring-black">
            ShadowPath
          </span>
          <ul className="flex list-none gap-1.5 p-0">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 hc:focus:ring-black ${
                      isActive
                        ? "bg-slate-900 text-white hc:bg-black"
                        : "text-slate-700 hover:bg-slate-100 hc:text-black hc:hover:bg-white"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <HighContrastToggle />
      </div>
    </nav>
  );
}
