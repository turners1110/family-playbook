import type { Metadata } from "next";

export const metadata: Metadata = { title: "Essentials" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
