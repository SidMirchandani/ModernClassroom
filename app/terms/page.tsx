import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, LegalPage, Section } from "@/components/LegalPage";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "The terms you agree to when you use Modern Classroom: what it does, what is expected of you, and what is not promised.",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated={SITE.policyUpdated}>
      <Section heading="What this is">
        <p>
          {SITE.name} is software for running a self-paced class: a teacher lays
          out a curriculum, students work through it at their own speed, and the
          teacher can see where everyone is. Using it means agreeing to what
          follows. If you do not agree, do not use it.
        </p>
      </Section>

      <Section heading="Accounts">
        <Bullets
          items={[
            "You are responsible for what happens under your account, and for keeping your password to yourself.",
            "Give a real name and a real email address — classmates and teachers identify each other by them.",
            "One person, one account. Do not share logins, and do not create an account for someone else without their knowledge.",
            "A class join code is not a secret worth much; treat it as an invitation, not a credential.",
          ]}
        />
      </Section>

      <Section heading="Teachers and student data">
        <p>
          If you create a class and enrol students, you are the one deciding that
          their work is recorded here. That means:
        </p>
        <Bullets
          items={[
            "You confirm you have whatever permission your school requires before entering student information.",
            "You are responsible for what you upload — including that you have the right to upload it, and that files you attach do not contain other people's personal information.",
            "Deleting a class permanently deletes every student's work in it. That cannot be undone.",
          ]}
        />
      </Section>

      <Section heading="Acceptable use">
        <p>Do not:</p>
        <Bullets
          items={[
            "Try to reach data belonging to a class you are not part of, or probe the service for ways to do so.",
            "Upload anything unlawful, malicious, or that you do not have the right to share.",
            "Use the curriculum import to process documents that are not yours to process.",
            "Automate the service in a way that degrades it for others, or resell access to it.",
          ]}
        />
        <p>
          Accounts doing any of the above can be suspended without notice. If you
          find a security hole, tell us at{" "}
          <a
            href={`mailto:${SITE.contactEmail}`}
            className="text-primary dark:text-primary-glow hover:underline"
          >
            {SITE.contactEmail}
          </a>{" "}
          rather than using it — good-faith reports are welcome and will never be
          met with legal threats.
        </p>
      </Section>

      <Section heading="The AI import, specifically">
        <p>
          The curriculum import reads documents you give it and{" "}
          <strong>proposes</strong> changes. It can misread a date, miss a row, or
          misjudge which subunit a line refers to. That is why nothing it
          produces is saved until you have reviewed and approved it.
        </p>
        <p>
          Approving a proposal is your decision and your responsibility. Check
          the diff before you press Apply — particularly anything marked as a
          removal.
        </p>
      </Section>

      <Section heading="Availability and your work">
        <p>
          This is provided as-is, with no guarantee that it will be available,
          uninterrupted, or free of defects. Keep your own copy of anything you
          could not stand to lose — a curriculum that exists only here is a
          curriculum with one copy.
        </p>
        <p>
          To the fullest extent the law allows, liability for any loss arising
          from using the service is limited to what you paid to use it. The
          service is currently free, so that amount is nothing. This does not
          limit liability for anything that cannot lawfully be limited.
        </p>
      </Section>

      <Section heading="Ending things">
        <p>
          You can stop using the service whenever you like, and ask for your
          account to be deleted — see{" "}
          <Link
            href="/privacy"
            className="text-primary dark:text-primary-glow hover:underline"
          >
            Privacy
          </Link>
          . Access may be ended if these terms are broken, or if the service is
          discontinued; in that case there will be reasonable notice and a way to
          export what is yours.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          These terms can change. The date at the top says when they last did,
          and material changes are announced to account holders before taking
          effect. Continuing to use the service after that means accepting the
          new version.
        </p>
      </Section>
    </LegalPage>
  );
}
