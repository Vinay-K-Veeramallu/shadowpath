"use client";
import Link from "next/link";
import { HighContrastToggle } from "./HighContrastToggle";

export function Nav() {
  return (
    <nav className="flex items-center justify-between px-4 py-3 border-b bg-white hc:bg-white hc:border-black dark:bg-gray-900">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 hc:focus:bg-black focus:text-white focus:rounded"
      >
        Skip to content
      </a>
      <ul className="flex gap-6 list-none m-0 p-0">
        <li>
          <Link href="/" className="text-sm font-medium text-gray-700 hc:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 hc:focus:ring-black rounded">
            Home
          </Link>
        </li>
        <li>
          <Link href="/planner" className="text-sm font-medium text-gray-700 hc:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 hc:focus:ring-black rounded">
            Day Planner
          </Link>
        </li>
        <li>
          <Link href="/why-this-matters" className="text-sm font-medium text-gray-700 hc:text-black hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 hc:focus:ring-black rounded">
            Why This Matters
          </Link>
        </li>
      </ul>
      <HighContrastToggle />
    </nav>
  );
}
