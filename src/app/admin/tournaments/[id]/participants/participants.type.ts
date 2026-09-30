export type Participant = {
  id: string;
  userId: string;
  name: string;
  seed: number | null;
};

export type ParticipantsResult = {
  status: "DRAFT" | "IN_PROGRESS" | "FINISHED";
  canEdit: boolean;
  items: Participant[];
};

export type Member = {
  id: string;
  name: string;
  email: string;
};

export type MemberPage = {
  items: Member[];
  page: number;
  pageSize: number;
  total: number;
};
