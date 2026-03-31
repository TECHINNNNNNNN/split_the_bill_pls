import confetti from "canvas-confetti";

/**
 * Celebration burst — fires when all payments are confirmed.
 * Warm café palette with gentle, floaty particles.
 */
export function fireAllPaidConfetti() {
  const colors = [
    "#5c3d2e",  // chocolate brown
    "#C4956A",  // warm gold
    "#D4A5A5",  // blush pink
    "#B5C7A3",  // sage green
    "#E8C8A0",  // soft caramel
    "#f5e6d0",  // cream
  ];

  // Big center burst — slow, floaty
  confetti({
    particleCount: 80,
    spread: 100,
    origin: { y: 0.6 },
    colors,
    gravity: 0.5,
    scalar: 1.3,
    drift: 0,
    ticks: 300,
    shapes: ["circle"],
  });

  // Delayed second burst — wider, softer
  setTimeout(() => {
    confetti({
      particleCount: 50,
      spread: 120,
      origin: { y: 0.5 },
      colors,
      gravity: 0.4,
      scalar: 1.5,
      drift: 0.5,
      ticks: 350,
      shapes: ["circle"],
    });
  }, 400);

  // Gentle side sprinkles
  setTimeout(() => {
    confetti({
      particleCount: 30,
      angle: 60,
      spread: 50,
      origin: { x: 0.1, y: 0.7 },
      colors,
      gravity: 0.6,
      scalar: 1.1,
      ticks: 250,
      shapes: ["circle"],
    });
    confetti({
      particleCount: 30,
      angle: 120,
      spread: 50,
      origin: { x: 0.9, y: 0.7 },
      colors,
      gravity: 0.6,
      scalar: 1.1,
      ticks: 250,
      shapes: ["circle"],
    });
  }, 200);
}
