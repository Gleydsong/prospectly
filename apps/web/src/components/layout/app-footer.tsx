import { Link } from 'react-router-dom';

export function AppFooter() {
  return (
    <footer className="border-t border-[color:var(--border-default)] py-5">
      <p className="px-4 text-center text-sm text-[color:var(--ink-secondary)] lg:px-6">
        <Link to="/" className="font-semibold text-[color:var(--ink)]">
          Prospectly
        </Link>
        <span aria-hidden> · </span>
        <span>© {new Date().getFullYear()}</span>
      </p>
    </footer>
  );
}
