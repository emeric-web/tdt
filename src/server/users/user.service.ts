import { createMemberSchema } from "@/server/users/user.schemas";
import { listMembersSchema } from "@/server/users/user.schemas";
import type {
  MemberPage,
  PublicUser,
  UserRepository,
} from "@/server/users/user.repository";

export type PasswordHasher = (password: string) => Promise<string>;

export class UserService {
  constructor(
    private readonly repository: UserRepository,
    private readonly hashPassword: PasswordHasher,
  ) {}

  async createMember(input: unknown): Promise<PublicUser> {
    const member = createMemberSchema.parse(input);
    const passwordHash = await this.hashPassword(member.temporaryPassword);

    return this.repository.createMember({
      name: member.name,
      email: member.email,
      passwordHash,
    });
  }

  listMembers(input: unknown = {}): Promise<MemberPage> {
    const query = listMembersSchema.parse(input);

    return this.repository.findMembers(query);
  }

  anonymizeMember(userId: string): Promise<void> {
    return this.repository.anonymizeMember(userId);
  }
}
