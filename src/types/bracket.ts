export type BracketPlayer = {
  id: string;
  name: string;
};

export type MatchStatus =
  "PENDING" | "DECLARED" | "CORRECTION_PROPOSED" | "DISPUTED" | "VALIDATED";

export type ScoreStatus =
  "NONE" | "DECLARED" | "CORRECTION_PROPOSED" | "DISPUTED" | "VALIDATED";

export type SetScore = {
  p1: number;
  p2: number;
  tb?: number;
};

export type MatchDto = {
  id: string;
  round: number;
  position: number;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  status: MatchStatus;
  scoreStatus: ScoreStatus;
  winnerId: string | null;
  declaredById: string | null;
  declaredWinnerId?: string | null;
  proposedWinnerId?: string | null;
  score: SetScore[] | null;
  proposedScore: SetScore[] | null;
  isBye: boolean;
  scheduledAt: string | null;
  court: string | null;
};

export type BracketRound = {
  round: number;
  matches: MatchDto[];
};

export type BracketData = {
  tournament: {
    id: string;
    name: string;
    startDate: string | null;
    finalSetSuperTiebreak: boolean;
    status: "DRAFT" | "IN_PROGRESS" | "FINISHED";
  };
  rounds: BracketRound[];
};

export type BracketProps = {
  rounds: BracketRound[];
};

export type MatchCardProps = {
  match: MatchDto;
};

export type PlayerLineProps = {
  player: BracketPlayer | null;
  side: "p1" | "p2";
  sets: SetScore[] | null;
  pending: boolean;
  isWinner: boolean;
  isBye: boolean;
};
