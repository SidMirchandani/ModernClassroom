import bcrypt from "bcryptjs";
import type { PublicUser } from "./db/types";
import {
  acceptPendingInvites,
  createUser,
  findUserByEmailOrUsername,
  findUserById,
  generateUsername,
  getDb,
} from "./db/client";

export const SESSION_STORAGE_KEY = "modern-classroom-session";

export function toPublicUser(user: {
  id: string;
  email: string;
  username: string;
  role: PublicUser["role"];
  firstName: string;
  lastName: string;
}): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export function getSessionUserId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_STORAGE_KEY);
}

export function setSession(userId: string): void {
  localStorage.setItem(SESSION_STORAGE_KEY, userId);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export function getCurrentUser(): PublicUser | null {
  const userId = getSessionUserId();
  if (!userId) return null;
  const user = findUserById(userId);
  return user ? toPublicUser(user) : null;
}

export async function loginUser(
  identifier: string,
  password: string
): Promise<PublicUser> {
  const user = findUserByEmailOrUsername(identifier.trim());
  if (!user) throw new Error("Invalid email/username or password");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid email/username or password");

  acceptPendingInvites(user.id);
  setSession(user.id);
  return toPublicUser(user);
}

export async function signupUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<PublicUser> {
  if (data.password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const db = getDb();
  const username = generateUsername(db, data.firstName.trim(), data.lastName.trim());
  const passwordHash = await bcrypt.hash(data.password, 10);

  const user = createUser({
    email: data.email.trim().toLowerCase(),
    username,
    passwordHash,
    role: "member",
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
  });

  acceptPendingInvites(user.id);
  setSession(user.id);
  return toPublicUser(user);
}

export function logoutUser(): void {
  clearSession();
}
