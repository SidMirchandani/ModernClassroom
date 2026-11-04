import { dueInstant, type OwnWork, type PlannedTopic, type PlannedWork, type WorkField } from "./plan";

/**
 * The handful of Google Classroom REST calls the sync makes. Thin on purpose:
 * deciding what to call is `plan.ts`; this only speaks the wire format.
 */

const API = "https://classroom.googleapis.com/v1";

export class ClassroomError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new ClassroomError(res.status, json?.error?.message ?? `HTTP ${res.status}`);
  return json as T;
}

export interface Course {
  id: string;
  name: string;
  section?: string;
}

export async function listTeacherCourses(token: string): Promise<Course[]> {
  const { courses = [] } = await call<{ courses?: Course[] }>(
    token,
    "GET",
    "/courses?teacherId=me&courseStates=ACTIVE&pageSize=100"
  );
  return courses.map(({ id, name, section }) => ({ id, name, section }));
}

export async function createTopic(token: string, courseId: string, topic: PlannedTopic): Promise<string> {
  const created = await call<{ topicId: string }>(token, "POST", `/courses/${courseId}/topics`, {
    name: topic.name.slice(0, 100),
  });
  return created.topicId;
}

/** The state Classroom stores: a scheduled post is a DRAFT with a scheduledTime. */
function stateFields(work: PlannedWork) {
  switch (work.target.state) {
    case "PUBLISHED":
      return { state: "PUBLISHED" };
    case "SCHEDULED":
      return { state: "DRAFT", scheduledTime: work.target.at };
    case "DRAFT":
      return { state: "DRAFT" };
  }
}

function path(courseId: string, work: PlannedWork): string {
  return `/courses/${courseId}/${work.kind === "material" ? "courseWorkMaterials" : "courseWork"}`;
}

export async function createWork(
  token: string,
  courseId: string,
  topicId: string | undefined,
  work: PlannedWork
): Promise<WireItem> {
  const body: Record<string, unknown> = {
    title: work.title,
    description: work.description || undefined,
    topicId,
    materials: work.links.length ? work.links.map((url) => ({ link: { url } })) : undefined,
    ...stateFields(work),
  };
  if (work.kind === "assignment") {
    body.workType = "ASSIGNMENT";
    if (work.maxPoints !== undefined) body.maxPoints = work.maxPoints;
    if (work.due) {
      body.dueDate = work.due.date;
      body.dueTime = work.due.time;
    }
  }
  return call<WireItem>(token, "POST", path(courseId, work), body);
}

/**
 * Send what changed about an existing item. Publishing clears the schedule, and
 * a due date left out of the body with its fields in the mask is cleared.
 * Returns the item as Classroom now has it, so that what Classroom does to the
 * text on the way in isn't later mistaken for a teacher's edit.
 */
export async function updateWork(
  token: string,
  courseId: string,
  classroomId: string,
  work: PlannedWork,
  fields: WorkField[]
): Promise<WireItem> {
  const body: Record<string, unknown> = {};
  const mask: string[] = [];
  if (fields.includes("title")) {
    mask.push("title");
    body.title = work.title;
  }
  if (fields.includes("description")) {
    mask.push("description");
    body.description = work.description;
  }
  if (fields.includes("due") && work.kind === "assignment") {
    mask.push("dueDate", "dueTime");
    if (work.due) {
      body.dueDate = work.due.date;
      body.dueTime = work.due.time;
    }
  }
  if (fields.includes("state")) {
    // Google refuses `state` in the mask unless it is publishing: an item that
    // stays a draft only has its schedule changed. In the mask and absent from
    // the body, the schedule is cleared.
    if (work.target.state === "PUBLISHED") {
      mask.push("state");
      body.state = "PUBLISHED";
    } else {
      mask.push("scheduledTime");
      if (work.target.state === "SCHEDULED") body.scheduledTime = work.target.at;
    }
  }
  return call<WireItem>(token, "PATCH", `${path(courseId, work)}/${classroomId}?updateMask=${mask.join(",")}`, body);
}

export async function renameTopic(token: string, courseId: string, topicId: string, name: string): Promise<void> {
  await call(token, "PATCH", `/courses/${courseId}/topics/${topicId}?updateMask=name`, { name: name.slice(0, 100) });
}

export async function deleteTopic(token: string, courseId: string, topicId: string): Promise<void> {
  await call(token, "DELETE", `/courses/${courseId}/topics/${topicId}`);
}

export async function listTopics(token: string, courseId: string): Promise<{ id: string; name: string }[]> {
  const topics: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "100" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await call<{ topic?: { topicId: string; name?: string }[]; nextPageToken?: string }>(
      token,
      "GET",
      `/courses/${courseId}/topics?${query}`
    );
    for (const t of page.topic ?? []) topics.push({ id: t.topicId, name: t.name ?? "" });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return topics;
}

/** An item as Classroom sends it. */
export interface WireItem {
  id: string;
  title?: string;
  description?: string;
  topicId?: string;
  state?: string;
  scheduledTime?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  associatedWithDeveloper?: boolean;
}

export function wireState(row: WireItem): OwnWork["state"] {
  return row.state === "PUBLISHED" ? "PUBLISHED" : row.scheduledTime ? "SCHEDULED" : "DRAFT";
}

export function wireDue(row: WireItem): string | null {
  if (!row.dueDate) return null;
  return dueInstant({
    date: row.dueDate,
    time: { hours: row.dueTime?.hours ?? 0, minutes: row.dueTime?.minutes ?? 0 },
  });
}

export interface ClassroomWork extends OwnWork {
  /** This app made it, so this app may change it. */
  own: boolean;
}

/**
 * Every draft, scheduled and posted item in the course. Those this app made
 * (`associatedWithDeveloper`) are what the links are squared against. The rest
 * the teacher made by hand: the grid reads them, and the app never changes them.
 */
export async function listWork(token: string, courseId: string): Promise<ClassroomWork[]> {
  const own: ClassroomWork[] = [];
  const kinds = [
    { kind: "assignment" as const, path: "courseWork", list: "courseWork", states: "courseWorkStates" },
    { kind: "material" as const, path: "courseWorkMaterials", list: "courseWorkMaterial", states: "courseWorkMaterialStates" },
  ];
  for (const k of kinds) {
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: "200" });
      query.append(k.states, "PUBLISHED");
      query.append(k.states, "DRAFT");
      if (pageToken) query.set("pageToken", pageToken);
      const page = await call<Record<string, unknown>>(token, "GET", `/courses/${courseId}/${k.path}?${query}`);
      const rows = (page[k.list] ?? []) as WireItem[];
      for (const row of rows) {
        own.push({
          id: row.id,
          kind: k.kind,
          title: row.title ?? "",
          topicId: row.topicId,
          state: wireState(row),
          scheduledFor: row.scheduledTime ?? null,
          description: row.description ?? "",
          due: wireDue(row),
          own: Boolean(row.associatedWithDeveloper),
        });
      }
      pageToken = page.nextPageToken as string | undefined;
    } while (pageToken);
  }
  return own;
}

export async function deleteWork(
  token: string,
  courseId: string,
  item: { id: string; kind: "material" | "assignment" }
): Promise<void> {
  const path = item.kind === "material" ? "courseWorkMaterials" : "courseWork";
  await call(token, "DELETE", `/courses/${courseId}/${path}/${item.id}`);
}

export interface RosterStudent {
  userId: string;
  name: string;
}

/** The class's students, as Classroom has them. Needs the roster permission. */
export async function listStudents(token: string, courseId: string): Promise<RosterStudent[]> {
  const students: RosterStudent[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "200" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await call<{
      students?: { userId: string; profile?: { name?: { fullName?: string } } }[];
      nextPageToken?: string;
    }>(token, "GET", `/courses/${courseId}/students?${query}`);
    for (const s of page.students ?? []) {
      students.push({ userId: s.userId, name: s.profile?.name?.fullName ?? "Unnamed student" });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return students;
}

export interface Submission {
  userId: string;
  courseWorkId: string;
  state: string;
  late: boolean;
  assignedGrade: number | null;
  draftGrade: number | null;
}

/** Every student's work on every assignment: "-" asks for the whole course in one go. */
export async function listSubmissions(token: string, courseId: string): Promise<Submission[]> {
  const submissions: Submission[] = [];
  let pageToken: string | undefined;
  do {
    const query = new URLSearchParams({ pageSize: "500" });
    if (pageToken) query.set("pageToken", pageToken);
    const page = await call<{
      studentSubmissions?: {
        userId: string;
        courseWorkId: string;
        state?: string;
        late?: boolean;
        assignedGrade?: number;
        draftGrade?: number;
      }[];
      nextPageToken?: string;
    }>(token, "GET", `/courses/${courseId}/courseWork/-/studentSubmissions?${query}`);
    for (const s of page.studentSubmissions ?? []) {
      submissions.push({
        userId: s.userId,
        courseWorkId: s.courseWorkId,
        state: s.state ?? "NEW",
        late: s.late ?? false,
        assignedGrade: s.assignedGrade ?? null,
        draftGrade: s.draftGrade ?? null,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return submissions;
}
