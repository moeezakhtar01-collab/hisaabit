import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type User, type InsertUser } from "@shared/schema";

export async function createUser(data: InsertUser): Promise<User> {
  const [user] = await db.insert(users).values(data).returning();
  return user;
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
}

export async function getUserById(id: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

export async function setResetToken(email: string, token: string, expiry: Date): Promise<boolean> {
  const result = await db
    .update(users)
    .set({ resetToken: token, resetTokenExpiry: expiry })
    .where(eq(users.email, email))
    .returning();
  return result.length > 0;
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.resetToken, token))
    .limit(1);

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
    return false;
  }

  await db
    .update(users)
    .set({ password: newPassword, resetToken: null, resetTokenExpiry: null })
    .where(eq(users.id, user.id));

  return true;
}
