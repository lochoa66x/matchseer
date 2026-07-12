import { notFound } from "next/navigation";
import MatchSeerHome from "../../matchseer-client";
import type { Language } from "../../../lib/domain";
import {
  findSoccerCompetition,
  soccerCompetitionKeys,
} from "../../../lib/soccer-competitions";

type PageProps = {
  params?: Promise<{
    competition?: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return soccerCompetitionKeys().map((competition) => ({ competition }));
}

export default async function SoccerCompetitionPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const competition = findSoccerCompetition(resolvedParams?.competition);

  if (!competition) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const rawLanguage = Array.isArray(resolvedSearchParams?.lang)
    ? resolvedSearchParams?.lang[0]
    : resolvedSearchParams?.lang;
  const initialLanguage: Language =
    rawLanguage === "es" || rawLanguage === "fr" ? rawLanguage : "en";

  return (
    <MatchSeerHome
      competitionKey={competition.key}
      initialLanguage={initialLanguage}
    />
  );
}
