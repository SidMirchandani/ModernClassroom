import type { Metadata } from "next";
import { Bullets, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Modern Classroom stores, who can see it, where it lives, and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated={SITE.policyUpdated}>
      <Section heading="The short version">
        <p>
          {SITE.name} is a classroom tool. It stores the work a class does and
          nothing else. There is no advertising, no analytics, no tracking
          pixels, and no third-party scripts of any kind — the only companies
          involved are the ones hosting the database and, when a teacher asks
          for it, the one reading their curriculum files.
        </p>
        <p>
          Nothing here is sold, rented, or shared with anyone outside the class
          it belongs to. Ever. Not in any form, including anonymised or
          aggregated.
        </p>
      </Section>

      <Section id="student-data" heading="What is stored">
        <p>When you have an account, the following is kept:</p>
        <Bullets
          items={[
            <>
              <strong>Your account</strong> — your email address, first and last
              name, a username generated from your name, and your chosen colour.
              Your password is never stored; authentication is handled by
              Supabase, which keeps only a one-way hash.
            </>,
            <>
              <strong>Classes</strong> — the class name, its join code, and the
              curriculum: units, subunits, dates, resource references and
              checkpoints.
            </>,
            <>
              <strong>Progress</strong> — for each student, which steps of which
              resources they have marked done, where they have asked for help,
              what a teacher has approved or sent back, and checkpoint grades.
            </>,
            <>
              <strong>Anything uploaded</strong> — screenshots a student attaches
              as proof of practice, and files a teacher attaches to a subunit.
            </>,
          ]}
        />
        <p>
          No location data, no device fingerprinting, no browsing history, no
          contact lists. Nothing is collected in the background — every record
          above exists because someone in the class typed it or clicked it.
        </p>
      </Section>

      <Section heading="Who can see it">
        <p>
          Access is enforced by the database itself, not just by the interface,
          using PostgreSQL row-level security. That means a request that should
          not return a row does not return it, even if the app is wrong.
        </p>
        <Bullets
          items={[
            <>
              A <strong>teacher</strong> sees the roster, progress and grades for
              the classes they teach — and nothing from any other class.
            </>,
            <>
              A <strong>student</strong> sees their own progress and their own
              grades. They cannot see another student&apos;s work.
            </>,
            <>
              Everyone in a class can see the names and colours of the people in
              it. Email addresses are not visible to classmates.
            </>,
            <>
              Someone with no connection to a class sees nothing of it at all.
            </>,
          ]}
        />
      </Section>

      <Section heading="Where it lives">
        <p>
          On {SITE.hosting}. Data is encrypted in transit, and at rest by the
          hosting provider. Your browser also keeps a local copy of the classes
          you can see, so the app keeps working when your connection drops; that
          copy lives only on that device and is cleared when you sign out.
        </p>
        <p>
          The <strong>demo</strong> is a special case: it runs entirely inside
          your browser, with no account and no network. Nothing you do in the
          demo is ever sent anywhere, and it is discarded when you leave it.
        </p>
      </Section>

      <Section id="documents" heading="How your documents are read">
        <p>
          A teacher can upload their own planning documents — a timeline
          spreadsheet, a syllabus, a scan of a printed plan — and have them
          turned into a curriculum. When, and only when, a teacher presses that
          button:
        </p>
        <Bullets
          items={[
            <>
              The uploaded files and the current curriculum of that class are
              sent to Google&apos;s Gemini API to be read, and are subject to{" "}
              <a
                href="https://ai.google.dev/gemini-api/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary dark:text-primary-glow hover:underline"
              >
                Google&apos;s API terms
              </a>
              .
            </>,
            <>
              <strong>No student data is ever sent.</strong> Not names, not
              progress, not grades. The request contains curriculum structure and
              the teacher&apos;s own documents, and nothing else.
            </>,
            <>
              The result is a <strong>proposal</strong>. Nothing is written until
              the teacher has reviewed it and approved it, change by change.
            </>,
            <>
              This never runs on its own, on a schedule, or in the background.
            </>,
          ]}
        />
      </Section>

      <Section heading="Deleting things">
        <Bullets
          items={[
            <>
              A <strong>teacher</strong> can delete a class, which permanently
              removes it along with its curriculum, roster and all progress in
              it.
            </>,
            <>
              A <strong>student</strong> can leave a class, and a teacher can
              remove one. Their progress is kept but hidden, so rejoining
              restores their work; deleting the class removes it for good.
            </>,
            <>
              You can delete your <strong>account</strong> yourself, from the
              profile menu. It erases everything immediately and cannot be
              undone — including any class you teach and all the work students
              have done in it, which is spelled out and counted before you
              confirm.
            </>,
            <>
              If you would rather someone did it for you, or you have lost
              access to the account, email{" "}
              <a
                href={`mailto:${SITE.contactEmail}`}
                className="text-primary dark:text-primary-glow hover:underline"
              >
                {SITE.contactEmail}
              </a>
              .
            </>,
          ]}
        />
      </Section>

      <Section heading="Children and schools">
        <p>
          This tool is built for use inside a class, which usually means the
          school or teacher — not the student — decides that it will be used. If
          you are a school: you remain the controller of your students&apos;
          records, this service is a processor acting on your instructions, and
          we will delete or return data on your request. If your institution
          needs an agreement in place before student data is entered, contact us
          first and do not create student accounts until it is signed.
        </p>
        <p>
          Accounts are not knowingly created for children under 13 without the
          school or a parent arranging it. If you believe one has been, write to
          us and it will be removed.
        </p>
      </Section>

      <Section heading="Changes and contact">
        <p>
          If this policy changes in a way that affects what is collected or who
          can see it, the date at the top changes and anyone with an account is
          told before it takes effect.
        </p>
        <p>
          Questions, deletion requests, or anything that looks wrong:{" "}
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="text-primary dark:text-primary-glow hover:underline"
          >
            {SITE.contactEmail}
          </a>
          . For anything institutional — a district agreement, a records
          request — write to{" "}
          <a
            href={`mailto:${SITE.schoolEmail}`}
            className="text-primary dark:text-primary-glow hover:underline"
          >
            {SITE.schoolEmail}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
