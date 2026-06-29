import NflLabClient from "../nfl/nfl-lab-client";

export const dynamic = "force-dynamic";

export default function FantasySeerPage() {
  return <NflLabClient mode="fantasy" />;
}
