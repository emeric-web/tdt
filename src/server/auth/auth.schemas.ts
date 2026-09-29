import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(1)
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72),
});
