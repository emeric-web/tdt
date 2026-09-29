ALTER TABLE "Participant"
ADD CONSTRAINT "Participant_seed_positive_check"
CHECK ("seed" IS NULL OR "seed" > 0);

ALTER TABLE "Match"
ADD CONSTRAINT "Match_round_positive_check"
CHECK ("round" > 0),
ADD CONSTRAINT "Match_position_nonnegative_check"
CHECK ("position" >= 0),
ADD CONSTRAINT "Match_nextSlot_valid_check"
CHECK ("nextSlot" IS NULL OR "nextSlot" IN (1, 2)),
ADD CONSTRAINT "Match_players_distinct_check"
CHECK ("player1Id" IS NULL OR "player2Id" IS NULL OR "player1Id" <> "player2Id"),
ADD CONSTRAINT "Match_winner_is_player_check"
CHECK ("winnerId" IS NULL OR "winnerId" = "player1Id" OR "winnerId" = "player2Id"),
ADD CONSTRAINT "Match_validated_requires_winner_check"
CHECK ("status" <> 'VALIDATED' OR "winnerId" IS NOT NULL);
