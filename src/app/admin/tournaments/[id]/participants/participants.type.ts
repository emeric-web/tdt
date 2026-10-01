export type Participant = {
  id: string;
  userId: string;
  name: string;
  seed: number | null;
};

export type ParticipantsResult = {
  status: "DRAFT" | "IN_PROGRESS" | "FINISHED";
  canEdit: boolean;
  hasDraw: boolean;
  items: Participant[];
};

export type TournamentMatchResult = {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  isBye: boolean;
  nextMatchId: string | null;
  nextSlot: number | null;
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
