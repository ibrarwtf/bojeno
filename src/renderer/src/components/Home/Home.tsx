// TODO: unmatched_questions review UI — a listing here to browse answer-bank
// misses captured during real runs, answer them, and turn the generic ones
// into new apply.ts rules. Answered manually via chat + resolveUnmatchedQuestion
// for now. For open-ended/explain-style questions specifically (not a plain
// number - "describe a RAG system you've built", etc.) the eventual answer is
// an LLM call, not a rule - keep that as its own follow-up, not bundled into
// this UI's first version.
//
// TODO: company blacklist UI — company_blacklist is DB/migration-only right
// now (see db/queries/companyBlacklist.ts). A simple list + "add company +
// reason" view removes the need for a migration every time a new spam
// agency shows up.
export function Home(): React.JSX.Element {
  return (
    <div className="home">
      <h1 className="home-title">Home</h1>
      <p className="home-empty">Dashboard content coming soon.</p>
    </div>
  )
}
