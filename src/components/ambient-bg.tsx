"use client";

import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * Dual-brand atmosphere: clinic green wash left, lab purple wash right,
 * shared drifting grid and soft aurora blobs.
 */
export function AmbientBg() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 70% 80% at 8% 40%, rgba(13, 159, 110, 0.28), transparent 58%),
            radial-gradient(ellipse 70% 80% at 92% 40%, rgba(107, 78, 170, 0.26), transparent 58%),
            radial-gradient(ellipse 50% 40% at 50% 100%, rgba(14, 116, 144, 0.08), transparent 55%),
            linear-gradient(165deg, #e8f6f1 0%, #f3f5f7 42%, #efeaf7 100%)
          `,
        }}
      />

      <div
        className={`absolute -inset-[48px] opacity-[0.5] ${reduceMotion ? "" : "animate-grid-drift"}`}
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 90% 80% at 50% 45%, black, transparent 78%)",
        }}
      />

      {!reduceMotion && (
        <>
          <motion.div
            className="absolute -left-[18%] top-[8%] h-[55%] w-[48%] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(13, 159, 110, 0.34), transparent 70%)",
            }}
            animate={{ x: [0, 36, -14, 0], y: [0, 22, -18, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -right-[16%] top-[10%] h-[55%] w-[48%] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(107, 78, 170, 0.32), transparent 70%)",
            }}
            animate={{ x: [0, -30, 16, 0], y: [0, -20, 14, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute left-[38%] top-[48%] h-[26%] w-[26%] rounded-full blur-3xl"
            style={{
              background: "radial-gradient(circle, rgba(52, 211, 153, 0.16), transparent 70%)",
            }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.65, 0.35] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </>
      )}

      <DataDots reduceMotion={reduceMotion} />
    </div>
  );
}

function DataDots({ reduceMotion }: { reduceMotion: boolean }) {
  const dots = [
    { x: "10%", y: "24%", d: 2.2, color: "var(--clinic)" },
    { x: "22%", y: "68%", d: 1.6, color: "var(--clinic)" },
    { x: "38%", y: "18%", d: 2.4, color: "var(--clinic-accent)" },
    { x: "58%", y: "22%", d: 2.2, color: "var(--lab)" },
    { x: "74%", y: "58%", d: 1.8, color: "var(--lab)" },
    { x: "88%", y: "30%", d: 2.4, color: "var(--lab-light)" },
    { x: "16%", y: "44%", d: 1.4, color: "var(--clinic-light)" },
    { x: "82%", y: "74%", d: 2.0, color: "var(--lab-accent)" },
  ];

  return (
    <>
      {dots.map((dot, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: dot.x,
            top: dot.y,
            width: dot.d,
            height: dot.d,
            background: dot.color,
            opacity: 0.5,
          }}
          animate={
            reduceMotion
              ? undefined
              : {
                  opacity: [0.2, 0.75, 0.2],
                  scale: [1, 1.6, 1],
                }
          }
          transition={
            reduceMotion
              ? undefined
              : {
                  duration: 2.4 + i * 0.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.18,
                }
          }
        />
      ))}
    </>
  );
}
