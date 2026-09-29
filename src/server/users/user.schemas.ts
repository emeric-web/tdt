import { z } from "zod";

export const createMemberSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  temporaryPassword: z
    .string()
    .min(9)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
