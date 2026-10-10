"use client";

import { useState } from "react";

import { MatchScoreForm } from "./match-score-form";
import { MatchScoreConfirmationBtn } from "./match-score-confirmation-btn";
import type { BracketPlayer } from "@/types/bracket";

type MatchReviewActionsProps = {
  matchId: string;
  player1: BracketPlayer | null;
  player2: BracketPlayer | null;
  canReview: boolean;
  canReviewCorrection: boolean;
  finalSetSuperTiebreak: boolean;
};

export function MatchReviewActions({
  matchId,
  player1,
  player2,
  canReview,
  canReviewCorrection,
  finalSetSuperTiebreak,
}: MatchReviewActionsProps) {
  const [isCorrecting, setIsCorrecting] = useState(false);

  return (
    <>
    <div>
      <MatchScoreConfirmationBtn matchId={matchId} />
      {canReview && (
        <button
          type="button"
          onClick={() => setIsCorrecting((current) => !current)}
        >
          Corriger
        </button>
      )}
      {canReviewCorrection && <button type="button">Refuser</button>}
    </div>

    {isCorrecting && canReview && player1 && player2 && (
        <MatchScoreForm
          matchId={matchId}
          player1={player1}
          player2={player2}
          finalSetSuperTiebreak={finalSetSuperTiebreak}
          mode="propose-correction"
        />
      )}
      </>
  );
}
