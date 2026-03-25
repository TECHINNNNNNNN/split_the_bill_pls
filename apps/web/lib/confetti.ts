import confetti from "canvas-confetti";

/**
 * Celebration burst — fires when all payments are confirmed.
 * Colors/shapes are placeholders — swap during design polish phase.
 */
export function fireAllPaidConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;

  const frame = () => {
    // Left cannon
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899"],
    });

    // Right cannon
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#22c55e", "#3b82f6", "#f59e0b", "#ec4899"],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  frame();
}
