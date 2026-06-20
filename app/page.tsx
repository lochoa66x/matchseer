import MatchSeerHome from "./matchseer-client";
import type { Language } from "../lib/domain";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawLanguage = Array.isArray(params?.lang) ? params?.lang[0] : params?.lang;
  const initialLanguage: Language =
    rawLanguage === "es" || rawLanguage === "fr" ? rawLanguage : "en";

  return <MatchSeerHome initialLanguage={initialLanguage} />;
}
