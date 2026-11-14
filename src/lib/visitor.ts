const VISITOR_KEY = "hexis_visitor_id";
const GOAL_IDS_KEY = "hexis_goal_ids";

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `v_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = randomId();
    window.localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function rememberGoalId(goalId: string): void {
  if (typeof window === "undefined") return;
  const ids = getRememberedGoalIds();
  if (!ids.includes(goalId)) {
    ids.unshift(goalId);
    window.localStorage.setItem(GOAL_IDS_KEY, JSON.stringify(ids.slice(0, 20)));
  }
}

export function getRememberedGoalIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GOAL_IDS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function getRoomNickname(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(`hexis_room_${roomCode}_nickname`);
}

export function setRoomNickname(roomCode: string, nickname: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`hexis_room_${roomCode}_nickname`, nickname);
}
