import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { Link, matchPath, useLocation } from "react-router-dom";
import { Menu, ShieldCheck, X } from "lucide-react";

import { routeDefinitions } from "./routes";
import { HeadingFocusManager } from "./HeadingFocusManager";
import { publicAppConfig } from "./config";
import { Button } from "../shared/components/Button";
import { PageContainer } from "../shared/components/PageContainer";

interface AppShellProps {
  readonly children: ReactNode;
}

const primaryNav = routeDefinitions.filter((route) => route.nav === "primary");
const secondaryNav = routeDefinitions.filter(
  (route) => route.nav === "secondary",
);

export function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const firstFocusable = getFocusableElements(mobileMenuRef.current)[0];
    firstFocusable?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      handleMobileMenuKeyDown(event, mobileMenuRef.current, () => {
        closeMobileMenu(setMenuOpen, menuButtonRef.current);
      });
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={focusMainContent}>
        Skip to main content
      </a>
      <header className="site-header">
        <PageContainer className="site-header__inner">
          <Link className="wordmark" to="/" aria-label="FairScreen home">
            FairScreen
          </Link>
          <div className="desktop-nav">
            <NavList
              ariaLabel="Primary"
              pathname={location.pathname}
              routes={primaryNav}
            />
            <NavList
              ariaLabel="Secondary"
              className="site-nav--secondary"
              pathname={location.pathname}
              routes={secondaryNav}
            />
          </div>
          <div className="privacy-badge" aria-label="Local-first foundation">
            <ShieldCheck aria-hidden="true" size={18} strokeWidth={2.25} />
            <span>Local-first</span>
          </div>
          <Button
            aria-controls="mobile-menu"
            aria-expanded={isMenuOpen}
            className="mobile-menu-button"
            icon={<Menu aria-hidden="true" size={18} />}
            onClick={() => {
              setMenuOpen(true);
            }}
            ref={menuButtonRef}
            variant="secondary"
          >
            Menu
          </Button>
        </PageContainer>
      </header>
      {isMenuOpen ? (
        <div className="mobile-menu-layer">
          <div
            aria-labelledby="mobile-menu-title"
            aria-modal="true"
            className="mobile-menu-sheet"
            id="mobile-menu"
            ref={mobileMenuRef}
            role="dialog"
          >
            <div className="mobile-menu-heading">
              <h2 id="mobile-menu-title">FairScreen menu</h2>
              <Button
                aria-label="Close menu"
                icon={<X aria-hidden="true" size={18} />}
                onClick={() => {
                  closeMobileMenu(setMenuOpen, menuButtonRef.current);
                }}
                variant="quiet"
              >
                Close
              </Button>
            </div>
            <NavList
              ariaLabel="Mobile primary"
              className="site-nav--mobile"
              onNavigate={() => {
                setMenuOpen(false);
              }}
              pathname={location.pathname}
              routes={primaryNav}
            />
            <NavList
              ariaLabel="Mobile secondary"
              className="site-nav--mobile"
              onNavigate={() => {
                setMenuOpen(false);
              }}
              pathname={location.pathname}
              routes={secondaryNav}
            />
          </div>
        </div>
      ) : null}
      <HeadingFocusManager />
      <main id="main-content" className="site-main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <PageContainer className="site-footer__inner">
          <div className="site-footer__statement">
            <p>FairScreen is practice software, not an employer assessment.</p>
            <p>
              Local-first static app. Specification{" "}
              {publicAppConfig.specVersion}. Version{" "}
              {publicAppConfig.appVersion}.
            </p>
          </div>
          <nav aria-label="Footer" className="footer-links">
            <Link to="/privacy">Privacy</Link>
            <Link to="/methodology">Methodology</Link>
            <Link to="/accessibility">Accessibility</Link>
          </nav>
        </PageContainer>
      </footer>
    </div>
  );
}

function focusMainContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const main = document.getElementById("main-content");
  main?.focus({ preventScroll: false });
}

interface NavListProps {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly onNavigate?: () => void;
  readonly pathname: string;
  readonly routes: typeof primaryNav;
}

function NavList({
  ariaLabel,
  className,
  onNavigate,
  pathname,
  routes,
}: NavListProps) {
  const classes = ["site-nav", className].filter(Boolean).join(" ");

  return (
    <nav className={classes} aria-label={ariaLabel}>
      {routes.map((route) => {
        const active = isRouteActive(route.activePatterns, pathname);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={["nav-link", active ? "active" : ""]
              .filter(Boolean)
              .join(" ")}
            key={route.path}
            onClick={onNavigate}
            to={route.href}
          >
            {route.navLabel}
          </Link>
        );
      })}
    </nav>
  );
}

function isRouteActive(patterns: readonly string[], pathname: string) {
  return patterns.some((pattern) =>
    matchPath({ path: pattern, end: pattern === "/" }, pathname),
  );
}

function handleMobileMenuKeyDown(
  event: KeyboardEvent,
  menuElement: HTMLDivElement | null,
  closeMenu: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeMenu();
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = getFocusableElements(menuElement);
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (!firstElement || !lastElement) {
    return;
  }

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [];
  }

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), details summary, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

function closeMobileMenu(
  setMenuOpen: (open: boolean) => void,
  menuButton: HTMLButtonElement | null,
) {
  setMenuOpen(false);
  window.setTimeout(() => {
    menuButton?.focus();
  }, 0);
}
