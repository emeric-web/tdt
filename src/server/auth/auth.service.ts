import { credentialsSchema } from "@/server/auth/auth.schemas";
import type {
  AuthRepository,
  CredentialUser,
} from "@/server/auth/auth.repository";

export type AuthenticatedUser = Pick<
  CredentialUser,
  "id" | "name" | "email" | "role"
>;

export type PasswordVerifier = (
  password: string,
  passwordHash: string,
) => Promise<boolean>;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly verifyPassword: PasswordVerifier,
  ) {}

  async authenticate(credentials: unknown): Promise<AuthenticatedUser | null> {
    const parsedCredentials = credentialsSchema.safeParse(credentials);

    if (!parsedCredentials.success) {
      return null;
    }

    const user = await this.repository.findCredentialUserByEmail(
      parsedCredentials.data.email,
    );

    if (!user || user.anonymized) {
      return null;
    }

    const passwordIsValid = await this.verifyPassword(
      parsedCredentials.data.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      return null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
