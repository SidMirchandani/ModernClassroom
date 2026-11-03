import type { OwnWork, PlannedTopic, PlannedWork } from "./plan";

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
): Promise<string> {
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
  const created = await call<{ id: string }>(token, "POST", path(courseId, work), body);
  return created.id;
}

/**
 * Move an existing draft to its new state or date. Publishing clears the
 * schedule.
 */
export async function updateWorkState(
  token: string,
  courseId: string,
  classroomId: string,
  work: PlannedWork
): Promise<void> {
  const fields = stateFields(work);
  const mask = work.target.state === "PUBLISHED" ? "state" : "state,scheduledTime";
  await call(
    token,
    "PATCH",
    `${path(courseId, work)}/${classroomId}?updateMask=${mask}`,
    fields
  );
}

/**
 * Every draft, scheduled and posted item in the course that this app made
 * (`associatedWithDeveloper`) — what the clean-up compares against the links.
 * Items the teacher made by hand are left out: the app never touches those.
 */
export async function listOwnWork(token: string, courseId: string): Promise<OwnWork[]> {
  const own: OwnWork[] = [];
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
      const rows = (page[k.list] ?? []) as {
        id: string;
        title?: string;
        topicId?: string;
        state?: string;
        scheduledTime?: string;
        associatedWithDeveloper?: boolean;
      }[];
      for (const row of rows) {
        if (!row.associatedWithDeveloper) continue;
        own.push({
          id: row.id,
          kind: k.kind,
          title: row.title ?? "",
          topicId: row.topicId,
          state: row.state === "PUBLISHED" ? "PUBLISHED" : row.scheduledTime ? "SCHEDULED" : "DRAFT",
          scheduledFor: row.scheduledTime ?? null,
        });
      }
      pageToken = page.nextPageToken as string | undefined;
    } while (pageToken);
  }
  return own;
}

export async function deleteWork(token: string, courseId: string, item: OwnWork): Promise<void> {
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
