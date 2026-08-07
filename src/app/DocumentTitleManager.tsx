import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";

import { notFoundTitle, routeDefinitions } from "./routes";

export function DocumentTitleManager() {
  const location = useLocation();

  useEffect(() => {
    const route = routeDefinitions.find((definition) =>
      matchPath({ path: definition.path, end: true }, location.pathname),
    );
    const pageTitle = route?.documentTitle ?? notFoundTitle;
    document.title = `${pageTitle} | FairScreen`;
  }, [location.pathname]);

  return null;
}
