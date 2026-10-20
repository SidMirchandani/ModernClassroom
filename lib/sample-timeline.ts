import type { CurriculumUnit } from "./db/types";

/**
 * A sample built from this very class, with a few deliberate edits: two dates
 * moved, one subunit retitled, one inserted. The model still does the real
 * work of reading it, so the demo shows what a real import shows — including
 * that everything untouched stays untouched.
 */
export function sampleTimeline(units: CurriculumUnit[]): File {
  const rows: string[] = ["Unit,Subunit,Title,Date,Textbook"];
  const shifted = new Set<string>();

  units.slice(0, 3).forEach((unit) => {
    (unit.subunits ?? []).forEach((section, index) => {
      const textbook = section.tracks?.find((t) => t.kind === "textbook")?.reference ?? "";
      let title = section.title;
      let date = section.date ?? "";

      // One retitle and two nudged dates, so the diff has something honest in it.
      if (index === 0 && shifted.size === 0 && title) {
        title = `${title} (Review)`;
        shifted.add("title");
      } else if (date && shifted.size < 3) {
        const bumped = date.replace(/(\d+)\/(\d+)/, (_, m, d) => `${m}/${Number(d) + 1}`);
        if (bumped !== date) {
          date = bumped;
          shifted.add(`date-${section.id}`);
        }
      }

      rows.push(
        [unit.title, section.id, title, date, textbook]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
    });
  });

  const first = units[0];
  if (first && first.subunits.length > 0) {
    const last = first.subunits[first.subunits.length - 1];
    const [major, minor] = last.id.split(".");
    rows.push(
      [
        first.title,
        `${major}.${Number(minor) + 1}`,
        "Review and Practice Day",
        "",
        "",
      ]
        .map((v) => `"${v}"`)
        .join(",")
    );
  }

  return new File([rows.join("\n")], "Sample Time Line.csv", { type: "text/csv" });
}
