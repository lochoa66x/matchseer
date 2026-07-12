import {
  soccerCompetitions,
  type SoccerCompetitionConfig,
} from "../../lib/soccer-competitions";

export default function SoccerHubPage() {
  return (
    <main className="app-shell soccer-hub-shell">
      <section className="topbar soccer-hub-topbar" aria-label="MatchSeer soccer header">
        <div className="brand-lockup">
          <div className="brand-mark">
            <img
              className="brand-mark-image"
              src="/brand/matchseer-app-icon.svg"
              alt=""
              aria-hidden="true"
            />
          </div>
          <div className="brand-text">
            <p className="brand-wordmark">MatchSeer</p>
            <h1 className="brand-tagline">Soccer Seer rooms for tournaments, leagues, and continental nights.</h1>
          </div>
        </div>
        <nav className="main-nav" aria-label="Primary navigation">
          <a href="/">World Cup</a>
          <a href="/profootball">Gridiron Seer</a>
          <a href="/fantasyseer">Fantasy Seer</a>
        </nav>
      </section>

      <section className="soccer-hub-hero">
        <div>
          <span className="soccer-hub-kicker">Soccer Seer</span>
          <h2>One engine, different football rooms.</h2>
          <p>
            World Cup, Liga MX, and Champions League should share the same
            MatchSeer core while adapting the model to each competition format.
          </p>
        </div>
        <div className="soccer-hub-receipt">
          <strong>Shared model shell</strong>
          <span>Fixtures · standings · bracket paths · travel · weather · receipts</span>
        </div>
      </section>

      <section className="soccer-competition-grid" aria-label="Soccer competitions">
        {soccerCompetitions.map((competition) => (
          <CompetitionCard competition={competition} key={competition.key} />
        ))}
      </section>
    </main>
  );
}

function CompetitionCard({
  competition,
}: {
  competition: SoccerCompetitionConfig;
}) {
  const statusLabel =
    competition.liveDataStatus === "connected"
      ? "Live source connected"
      : competition.liveDataStatus === "provider-ready"
        ? "Provider-ready"
        : "Manual source needed";

  return (
    <a className="soccer-competition-card" href={competition.route}>
      <div className="soccer-card-topline">
        <span>{competition.shortName}</span>
        <em>{statusLabel}</em>
      </div>
      <h3>{competition.name}</h3>
      <p>{competition.promise}</p>
      <div className="soccer-card-meta">
        <span>{competition.region}</span>
        <span>{competition.seasonLabel}</span>
        <span>{competition.primaryStageLabel}</span>
      </div>
      <ul>
        {competition.modelNotes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </a>
  );
}
