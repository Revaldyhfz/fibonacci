import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/trades", label: "Trades" },
  { to: "/analytics", label: "Analytics" },
  { to: "/portfolio", label: "Portfolio" },
];

function navLinkClass({ isActive }) {
  return [
    "text-sm transition-colors",
    isActive ? "font-medium text-white" : "text-neutral-400 hover:text-white",
  ].join(" ");
}

export default function Header() {
  const nav = useNavigate();
  const { logout, user, isAdmin } = useAuth();

  const links = isAdmin
    ? [...baseLinks, { to: "/admin", label: "Admin" }]
    : baseLinks;

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-800 bg-[#141414]/95 backdrop-blur-sm shadow-lg">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0">
            <Link
              to="/dashboard"
              className="shrink-0 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
            >
              Fibonacci
            </Link>
            <nav className="hidden md:flex gap-6 min-w-0">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-purple-500/10 text-purple-300 border border-purple-500/30">
                Admin
              </span>
            )}
            <div className="hidden sm:block text-sm text-neutral-400 truncate max-w-[180px]">
              <span className="text-neutral-500">Welcome, </span>
              <span className="font-medium text-white">{user?.username || "Trader"}</span>
            </div>
            <button
              onClick={() => {
                logout();
                nav("/");
              }}
              className="text-sm px-3 py-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex gap-4 pb-3 overflow-x-auto -mx-1 px-1">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                [
                  "shrink-0 text-sm px-2 py-1 rounded-md transition-colors",
                  isActive
                    ? "text-white bg-neutral-800"
                    : "text-neutral-400 hover:text-white",
                ].join(" ")
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
