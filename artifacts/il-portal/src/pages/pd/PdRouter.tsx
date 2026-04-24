import { Switch, Route } from "wouter";
import type { SessionUser } from "../../lib/session";
import PdUserApp from "./PdUserApp";
import PdAdminLayout from "./PdAdminLayout";
import PdDashboard from "./PdDashboard";
import PdMasterUpload from "./PdMasterUpload";
import PdOtherLoansUpload from "./PdOtherLoansUpload";
import PdDateWiseDownload from "./PdDateWiseDownload";

export default function PdRouter({ session }: { session: SessionUser }) {
  if (session.role === "admin") {
    return (
      <PdAdminLayout session={session}>
        <Switch>
          <Route path="/" component={PdDashboard} />
          <Route path="/master-upload" component={PdMasterUpload} />
          <Route path="/other-loans-upload" component={PdOtherLoansUpload} />
          <Route path="/date-wise-download" component={PdDateWiseDownload} />
          <Route>
            <div className="text-sm text-slate-500">Page not found</div>
          </Route>
        </Switch>
      </PdAdminLayout>
    );
  }
  return (
    <Switch>
      <Route path="/" component={() => <PdUserApp session={session} />} />
      <Route>
        <div className="p-6">Page not found</div>
      </Route>
    </Switch>
  );
}
