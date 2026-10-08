import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * The footer every public page shares. It carries the things a real product is
 * expected to have within reach — what this is, how to try it, and the two
 * documents anyone handing over student data is entitled to read before they
 * do.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-auto">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-start gap-8 sm:gap-12">
          <div className="sm:w-64">
            <Logo href="/" textClassName="text-sm" />
            <p className="mt-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              A self-paced classroom where students move at their own speed and
              teachers can see exactly where everyone is.
            </p>
          </div>

          {/* Three groups into two phone columns leaves the last one stranded
              beside a gap, so on narrow it spans the row and lays its links out
              in a line instead. */}
          <nav className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-7 text-sm">
            <FooterGroup title="Product">
              <FooterLink href="/demo">Try the demo</FooterLink>
              <FooterLink href="/?auth=signup">Create an account</FooterLink>
              <FooterLink href="/?auth=login">Log in</FooterLink>
            </FooterGroup>

            <FooterGroup title="Legal">
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
            </FooterGroup>

            <FooterGroup title="For schools" className="col-span-2 sm:col-span-1" inline>
              <FooterLink href="/privacy#student-data">Student data</FooterLink>
              <FooterLink href="/privacy#documents">How documents are read</FooterLink>
            </FooterGroup>
          </nav>
        </div>

        <p className="mt-10 pt-6 border-t border-slate-100 dark:border-slate-800/60 text-xs text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Modern Classroom. Built for one teacher's
          classroom, and open to others.
        </p>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  children,
  className,
  inline = false,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Lay the links in a row while this group is spanning the phone grid. */
  inline?: boolean;
}) {
  return (
    <div className={className}>
      <p className="eyebrow-muted mb-2.5">{title}</p>
      <ul
        className={
          inline
            ? "flex flex-wrap gap-x-5 gap-y-1.5 sm:block sm:space-y-1.5"
            : "space-y-1.5"
        }
      >
        {children}
      </ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-slate-600 dark:text-slate-400 hover:text-primary dark:hover:text-primary-glow transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}
