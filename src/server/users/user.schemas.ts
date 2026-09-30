import { z } from "zod";

export const createMemberSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  temporaryPassword: z
    .string()
    .min(9)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
});

export const listMembersSchema = z.strictObject({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type ListMembersInput = z.infer<typeof listMembersSchema>;
