import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Договор-оферта" };

export default function OfferPage() {
  return <LegalPage name="offer" />;
}
