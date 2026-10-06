import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BsBarChartLine, BsBoxArrowRight, BsFolder2, BsJournalText } from 'react-icons/bs';
import { useAuth } from '../../contexts/auth';
import ThemeToggle from '../ui/ThemeToggle';

// Charts are only downloaded when someone opens them.
const StatsModal = lazy(() => import('../stats/StatsModal'));

const NAV = [
  { to: '/', label: 'Notes', icon: BsJournalText, end: true },
  { to: '/collections', label: 'Collections', icon: BsFolder2 }
];

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.type === 'keydown' ? event.key === 'Escape' : !menuRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="account" ref={menuRef}>
      <button
        type="button"
        className="avatar"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.email}`}
      >
        {user.email[0].toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="menu__label">Signed in as</p>
          <p className="menu__email">{user.email}</p>
          <button type="button" role="menuitem" className="menu__item" onClick={handleLogout}>
            <BsBoxArrowRight aria-hidden="true" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const [statsOpen, setStatsOpen] = useState(false);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <NavLink to="/" className="brand" aria-label="Notes home">
            <span className="brand__mark" aria-hidden="true">N</span>
            <span className="brand__name">Notes</span>
          </NavLink>

          <nav className="topnav" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className="topnav__link">
                <Icon aria-hidden="true" /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="topbar__actions">
            <button
              type="button"
              className="icon-button"
              onClick={() => setStatsOpen(true)}
              aria-label="Insights"
              title="Insights"
            >
              <BsBarChartLine aria-hidden="true" />
            </button>
            <ThemeToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      {/* Phones get a bottom tab bar instead of the header links. */}
      <nav className="tabbar" aria-label="Main">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__link">
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {statsOpen && (
        <Suspense fallback={null}>
          <StatsModal onClose={() => setStatsOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
