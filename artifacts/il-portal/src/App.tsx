import { useEffect, useState } from "react";
import { Router, Route, Switch, Redirect } from "wouter";
import { loadSession, type SessionUser } from "./lib/session";
import LoginPage from "./pages/Login";
import HubPage from "./pages/Hub";
import UserMgmtPage from "./pages/UserMgmt";
import LucRouter from "./pages/luc/LucRouter";
import PdRouter from "./pages/pd/PdRouter";
import NotFound from "./pages/not-found";

function useSession(): SessionUser | null {
  const [s, setS] = useState<SessionUser | null>(() => loadSession());
  useEffect(() => {
    const fn = () => setS(loadSession());
    window.addEventListener("ilPortalSession:change", fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener("ilPortalSession:change", fn);
      window.removeEventListener("storage", fn);
    };
  }, []);
  return s;
}

function basePath(): string {
  const b = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return b;
}

export default function App() {
  const session = useSession();

  return (
    <Router base={basePath()}>
      <Switch>
        <Route path="/login">
          {session ? <Redirect to="/" /> : <LoginPage />}
        </Route>
        {!session ? (
          <Route>
            <Redirect to="/login" />
          </Route>
        ) : (
          <>
            <Route path="/" component={HubPage} />
            <Route path="/users" component={UserMgmtPage} />
            <Route path="/pd" nest>
              <PdRouter session={session} />
            </Route>
            <Route path="/luc" nest>
              <LucRouter session={session} />
            </Route>
            <Route component={NotFound} />
          </>
        )}
      </Switch>
    </Router>
  );
}
