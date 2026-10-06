/**
 * The handful of facts the public pages and policies quote. They live here so
 * the contact address and the product name are changed in one place rather
 * than in prose scattered across three files.
 */

export const SITE = {
  name: "Modern Classroom",
  tagline: "Self-paced learning, teacher oversight.",
  description:
    "A self-paced classroom where students move through the curriculum at their own speed, each resource tracked separately, and teachers see exactly who is stuck.",
  /**
   * Where privacy, deletion and support requests go. The personal address is
   * the one printed, deliberately: a school mailbox is lost the day you change
   * schools, and a deletion request has to reach someone years from now. The
   * school address is listed beside it for anything institutional.
   */
  contactEmail: "siddharth.mirchandani@gmail.com",
  schoolEmail: "mirchandanis28@mcmsnj.net",
  /** Where the data actually lives, named in the privacy policy. */
  hosting: "Supabase (PostgreSQL, hosted on AWS in us-east-1)",
  policyUpdated: "4 October 2026",
} as const;
