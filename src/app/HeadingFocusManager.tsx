import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function HeadingFocusManager() {
  const location = useLocation();
  const hasCompletedInitialRender = useRef(false);

  useEffect(() => {
    if (!hasCompletedInitialRender.current) {
      hasCompletedInitialRender.current = true;
      return;
    }

    const heading = document.querySelector<HTMLElement>("main h1");
    heading?.focus({ preventScroll: true });
  }, [location.key, location.pathname]);

  return null;
}
