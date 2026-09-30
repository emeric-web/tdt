"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import {
  isErrorResponse,
  isMemberPage,
  isParticipantsResult,
} from "./participants.type-guards";
import type {
  Member,
  Participant,
  ParticipantsResult,
} from "./participants.type";

export function ManageParticipants({ tournamentId }: { tournamentId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageCount, setMemberPageCount] = useState(1);
  const [status, setStatus] = useState<ParticipantsResult["status"]>("DRAFT");
  const [canEdit, setCanEdit] = useState(false);
  const [seeds, setSeeds] = useState<Record<string, string>>({});
  const [selectedUserId, setSelectedUserId] = useState("");
  const [newSeed, setNewSeed] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let isCurrent = true;

    async function loadData() {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const [participantsResponse, membersResponse] = await Promise.all([
          fetch(`/api/tournaments/${tournamentId}/participants`),
          fetch(`/api/users?page=${memberPage}&pageSize=20`),
        ]);

        if (!participantsResponse.ok || !membersResponse.ok) {
          throw new Error(
            `Unable to load participant data (${participantsResponse.status}, ${membersResponse.status}).`,
          );
        }

        const [participantsResult, membersResult]: [unknown, unknown] =
          await Promise.all([
            participantsResponse.json(),
            membersResponse.json(),
          ]);
        if (
          !isParticipantsResult(participantsResult) ||
          !isMemberPage(membersResult)
        ) {
          throw new Error(
            "Participant management response has an invalid shape.",
          );
        }

        if (isCurrent) {
          setParticipants(participantsResult.items);
          setStatus(participantsResult.status);
          setCanEdit(participantsResult.canEdit);
          setSeeds(
            Object.fromEntries(
              participantsResult.items.map((participant) => [
                participant.id,
                participant.seed?.toString() ?? "",
              ]),
            ),
          );
          setMembers(membersResult.items);
          setMemberPageCount(
            Math.max(
              1,
              Math.ceil(membersResult.total / membersResult.pageSize),
            ),
          );
          const availableMembers = membersResult.items.filter(
            (member) =>
              !participantsResult.items.some(
                (participant) => participant.userId === member.id,
              ),
          );
          setSelectedUserId((currentId) =>
            availableMembers.some((member) => member.id === currentId)
              ? currentId
              : (availableMembers[0]?.id ?? ""),
          );
        }
      } catch (error) {
        console.error("Unable to load tournament participants.", error);
        if (isCurrent) {
          setErrorMessage("Impossible de charger les inscriptions. Réessayez.");
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isCurrent = false;
    };
  }, [memberPage, reloadCount, tournamentId]);

  function refresh() {
    setIsLoading(true);
    setErrorMessage(null);
    setReloadCount((count) => count + 1);
  }

  const registeredUserIds = new Set(
    participants.map((participant) => participant.userId),
  );
  const availableMembers = members.filter(
    (member) => !registeredUserIds.has(member.id),
  );
  const canManage = status === "DRAFT" && canEdit;

  async function sendMutation(
    url: string,
    method: "POST" | "PATCH",
    body: object,
  ) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result: unknown = await response.json();

    if (!response.ok) {
      throw new Error(
        isErrorResponse(result)
          ? result.error.message
          : "Impossible d'enregistrer cette modification.",
      );
    }
  }

  async function handleAddParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      await sendMutation(
        `/api/tournaments/${tournamentId}/participants`,
        "POST",
        {
          userId: selectedUserId,
          ...(newSeed ? { seed: Number(newSeed) } : {}),
        },
      );
      setSuccessMessage("Le membre a été inscrit au tournoi.");
      setNewSeed("");
      refresh();
    } catch (error) {
      console.error("Unable to register tournament participant.", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de contacter le serveur. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSeedUpdate(participantId: string) {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      const value = seeds[participantId] ?? "";
      await sendMutation(
        `/api/tournaments/${tournamentId}/participants/${participantId}`,
        "PATCH",
        { seed: value === "" ? null : Number(value) },
      );
      setSuccessMessage("La tête de série a été mise à jour.");
      refresh();
    } catch (error) {
      console.error("Unable to update participant seed.", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de contacter le serveur. Réessayez.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section>
      <p>
        <Link href="/">Retour à la liste des tournois</Link>
      </p>
      {isLoading && <p role="status">Chargement des inscriptions…</p>}
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {successMessage && <p role="status">{successMessage}</p>}
      {!isLoading && !canManage && (
        <p>
          Les inscriptions et têtes de série sont verrouillées après le tirage
          ou l’activation du tournoi.
        </p>
      )}
      {!isLoading && canManage && (
        <form onSubmit={handleAddParticipant}>
          <h2>Inscrire un membre</h2>
          {availableMembers.length === 0 ? (
            <p>
              Aucun membre disponible sur cette page. Parcourez les pages de
              membres pour en chercher d’autres.
            </p>
          ) : (
            <>
              <label>
                Membre
                <select
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  disabled={isSubmitting}
                  required
                >
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Tête de série (facultative)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={newSeed}
                  onChange={(event) => setNewSeed(event.target.value)}
                  disabled={isSubmitting}
                />
              </label>
              <button type="submit" disabled={isSubmitting}>
                Inscrire le membre
              </button>
            </>
          )}
          {memberPageCount > 1 && (
            <nav aria-label="Pagination des membres disponibles">
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setMemberPage((page) => page - 1);
                }}
                disabled={memberPage <= 1 || isLoading || isSubmitting}
              >
                Membres précédents
              </button>
              <span>
                {" "}
                Page {memberPage} sur {memberPageCount}{" "}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setMemberPage((page) => page + 1);
                }}
                disabled={
                  memberPage >= memberPageCount || isLoading || isSubmitting
                }
              >
                Membres suivants
              </button>
            </nav>
          )}
        </form>
      )}
      <section aria-labelledby="participants-heading">
        <h2 id="participants-heading">Participants ({participants.length})</h2>
        {participants.length === 0 ? (
          <p>Aucun membre inscrit pour le moment.</p>
        ) : (
          <ul>
            {participants.map((participant) => (
              <li key={participant.id}>
                <span>
                  {participant.name} —{" "}
                  {participant.seed
                    ? `Tête de série no ${participant.seed}`
                    : "Sans tête de série"}
                </span>
                {canManage && (
                  <div>
                    <label>
                      Tête de série
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={seeds[participant.id] ?? ""}
                        onChange={(event) =>
                          setSeeds((current) => ({
                            ...current,
                            [participant.id]: event.target.value,
                          }))
                        }
                        disabled={isSubmitting}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleSeedUpdate(participant.id)}
                      disabled={isSubmitting}
                    >
                      Enregistrer la tête de série
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <button
        type="button"
        onClick={refresh}
        disabled={isLoading || isSubmitting}
      >
        Actualiser les inscriptions
      </button>
    </section>
  );
}
