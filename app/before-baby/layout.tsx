import type { Metadata } from "next";

export const metadata: Metadata = { title: "Before Baby" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
