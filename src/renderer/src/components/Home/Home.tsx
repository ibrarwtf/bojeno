// TODO: company blacklist UI — company_blacklist is DB/migration-only right
// now (see db/queries/companyBlacklist.ts). A simple list + "add company +
// reason" view removes the need for a migration every time a new spam
// agency shows up.
import { UnmatchedQuestions } from './UnmatchedQuestions'

export function Home(): React.JSX.Element {
  return (
    <div className="home">
      <h1 className="home-title">Home</h1>
      <UnmatchedQuestions />
    </div>
  )
}
