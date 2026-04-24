import { Switch, Route } from "wouter";
import type { SessionUser } from "../../lib/session";
import LucLayout from "./LucLayout";
import LucDashboard from "./LucDashboard";
import LucAllData from "./LucAllData";
import LucAddClient from "./LucAddClient";
import LucBulkUpload from "./LucBulkUpload";
import LucPending from "./LucPending";
import LucCompleted from "./LucCompleted";
import LucApprovals from "./LucApprovals";
import LucFieldVisit from "./LucFieldVisit";

export default function LucRouter({ session }: { session: SessionUser }) {
  const isAdmin = session.role === "admin";
  return (
    <LucLayout session={session}>
      <Switch>
        {isAdmin ? (
          <>
            <Route path="/" component={LucDashboard} />
            <Route path="/all-data" component={LucAllData} />
            <Route path="/add-client" component={LucAddClient} />
            <Route path="/bulk-upload" component={LucBulkUpload} />
            <Route path="/pending" component={LucPending} />
            <Route path="/completed" component={LucCompleted} />
            <Route path="/approvals" component={LucApprovals} />
          </>
        ) : (
          <Route path="/" component={LucFieldVisit} />
        )}
        <Route>
          <div className="text-sm text-slate-500">Page not found</div>
        </Route>
      </Switch>
    </LucLayout>
  );
}
