import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  sessionCookieOptions,
  toPublicUser,
} from "@/lib/auth";
import {
  acceptPendingInvites,
  createUser,
  generateUsername,
  getDb,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName } = body as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    };

    if (!email?.trim() || !password || !firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const username = generateUsername(db, firstName.trim(), lastName.trim());
    const passwordHash = await hashPassword(password);

    const user = await createUser({
      email: email.trim().toLowerCase(),
      username,
      passwordHash,
      role: "member",
      firstName: firstName.trim(),
      lastName: lastName.trim(),
    });

    await acceptPendingInvites(user.id);

    const token = await createSession(user.id);
    const response = NextResponse.json({ user: toPublicUser(user) });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
