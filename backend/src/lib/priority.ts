/**
 * ============================================================
 * PRIORITY QUEUE ENGINE
 * ============================================================
 */

// ---- Weights ----
const A = 3; // Waiting Time weight
const B = 0.5; // Profit weight
const C = 4; // Appointment weight
const D = 1; // Service Time penalty weight

export const FAIRNESS_THRESHOLD_MINUTES = 20;

export interface QueueCustomer {
  id: string; // Mongoose ObjectId as string
  arrivalTime: Date;
  serviceTime: number;
  profit: number;
  isAppointment: boolean;
  status: string;
  priorityScore: number;
}

export function calculatePriorityScore(customer: Omit<QueueCustomer, "priorityScore" | "id" | "status">, now: Date = new Date()): number {
  const waitingTime = Math.max(0, (now.getTime() - customer.arrivalTime.getTime()) / 60000);
  const appointment = customer.isAppointment ? 1 : 0;

  return (
    A * waitingTime +
    B * customer.profit +
    C * appointment -
    D * customer.serviceTime
  );
}

export function hasFairnessOverride(customer: { arrivalTime: Date }, now: Date = new Date()): boolean {
  const waitingMinutes = (now.getTime() - customer.arrivalTime.getTime()) / 60000;
  return waitingMinutes >= FAIRNESS_THRESHOLD_MINUTES;
}

export function getWaitingMinutes(arrivalTime: Date, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - arrivalTime.getTime()) / 60000);
}

export function getNextCustomer(customers: QueueCustomer[]): QueueCustomer | null {
  const active = customers.filter(c => c.status === "active");
  if (active.length === 0) return null;

  const now = new Date();

  // FAIRNESS RULE: Check for starving customers (WT >= 20 min)
  const starving = active.filter(c => hasFairnessOverride(c, now));
  if (starving.length > 0) {
    // Among starving, serve the one who has waited the longest (FIFO)
    return starving.reduce((oldest, curr) =>
      curr.arrivalTime < oldest.arrivalTime ? curr : oldest
    );
  }

  // Normal: highest priority score wins
  return active.reduce((best, curr) => {
    const bestScore = calculatePriorityScore(best, now);
    const currScore = calculatePriorityScore(curr, now);
    return currScore > bestScore ? curr : best;
  });
}

export function rebalanceQueue(customers: QueueCustomer[]): QueueCustomer[] {
  const now = new Date();

  return [...customers].sort((a, b) => {
    const aStarving = hasFairnessOverride(a, now);
    const bStarving = hasFairnessOverride(b, now);

    if (aStarving && !bStarving) return -1;
    if (!aStarving && bStarving) return 1;

    if (aStarving && bStarving) {
      return a.arrivalTime.getTime() - b.arrivalTime.getTime();
    }

    const scoreA = calculatePriorityScore(a, now);
    const scoreB = calculatePriorityScore(b, now);
    return scoreB - scoreA;
  });
}
