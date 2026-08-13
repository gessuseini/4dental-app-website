"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { motion } from "motion/react";
import { AmbientBg } from "@/components/ambient-bg";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { siteConfig } from "@/lib/site";

const ease = [0.22, 1, 0.36, 1] as const;

type Destination = typeof siteConfig.clinic | typeof siteConfig.lab;

export function Chooser() {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <main className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 py-10 sm:px-8">
      <AmbientBg />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center">
        <motion.div
          className="mb-10 flex flex-col items-center text-center sm:mb-12"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.45, ease }}
        >
          <span className="relative mb-5 sm:mb-6">
            <Image
              src={siteConfig.logo}
              alt=""
              width={88}
              height={88}
              className="relative z-10 h-[4.25rem] w-[4.25rem] sm:h-[5.25rem] sm:w-[5.25rem]"
              priority
              quality={100}
              unoptimized
            />
            {!reduceMotion && (
              <span
                className="absolute inset-0 rounded-full blur-2xl"
                style={{
                  background:
                    "linear-gradient(135deg, var(--clinic) 0%, var(--lab) 100%)",
                  opacity: 0.32,
                  animation: "pulse-ring 3s ease-in-out infinite",
                }}
                aria-hidden="true"
              />
            )}
          </span>
          <h1 className="font-display text-[clamp(2.6rem,10vw,5rem)] font-extrabold leading-[0.92] tracking-tighter text-foreground">
            {siteConfig.name}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted sm:mt-4 sm:text-[0.95rem]">
            {siteConfig.intro}
          </p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-foreground/40">
            {siteConfig.tagline}
          </p>
        </motion.div>

        <div className="grid w-full gap-4 sm:grid-cols-2 sm:gap-5">
          <DestinationLink
            destination={siteConfig.clinic}
            brand="clinic"
            delay={0.08}
            reduceMotion={reduceMotion}
          />
          <DestinationLink
            destination={siteConfig.lab}
            brand="lab"
            delay={0.16}
            reduceMotion={reduceMotion}
          />
        </div>
      </div>
    </main>
  );
}

function DestinationLink({
  destination,
  brand,
  delay,
  reduceMotion,
}: {
  destination: Destination;
  brand: "clinic" | "lab";
  delay: number;
  reduceMotion: boolean;
}) {
  const isClinic = brand === "clinic";
  const accent = isClinic ? "var(--clinic)" : "var(--lab)";
  const accentDark = isClinic ? "var(--clinic-dark)" : "var(--lab-dark)";
  const glow = isClinic ? "rgba(13, 159, 110, 0.35)" : "rgba(107, 78, 170, 0.35)";
  const wash = isClinic
    ? "linear-gradient(145deg, rgba(232, 246, 241, 0.9) 0%, rgba(255, 255, 255, 0.72) 100%)"
    : "linear-gradient(145deg, rgba(239, 234, 247, 0.9) 0%, rgba(255, 255, 255, 0.72) 100%)";

  return (
    <motion.a
      href={destination.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${destination.name}`}
      className="group relative block overflow-hidden rounded-[1.35rem] outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={
        {
          background: wash,
          border: "1px solid color-mix(in srgb, " + accent + " 28%, transparent)",
          boxShadow: `0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -28px ${glow}`,
          "--tw-ring-color": accent,
        } as CSSProperties
      }
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : delay, ease }}
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.015 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(ellipse 80% 70% at 50% 0%, ${glow}, transparent 65%)`,
        }}
        aria-hidden="true"
      />

      <span className="relative flex flex-col items-start gap-5 p-6 sm:gap-6 sm:p-8">
        <span className="relative shrink-0">
          <Image
            src={destination.logo}
            alt=""
            width={56}
            height={56}
            className="relative z-10 h-12 w-12 rounded-[0.95rem] sm:h-14 sm:w-14 sm:rounded-[1rem]"
            priority
            quality={100}
            unoptimized
          />
          {!reduceMotion && (
            <span
              className="absolute inset-0 rounded-[0.95rem] blur-xl sm:rounded-[1rem]"
              style={{
                background: accent,
                opacity: 0.28,
                animation: "pulse-ring 3s ease-in-out infinite",
              }}
            />
          )}
        </span>

        <span>
          <span
            className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] sm:text-[11px]"
            style={{ color: accentDark }}
          >
            {destination.hubLabel}
          </span>
          <span className="font-display block text-[1.55rem] font-extrabold leading-none tracking-tighter text-foreground sm:text-[1.85rem]">
            {destination.name}
          </span>
          <span className="mt-2 block text-sm leading-relaxed text-muted sm:text-[0.95rem]">
            {destination.description}
          </span>
        </span>

        <span
          className="mt-auto inline-flex items-center gap-2 text-sm font-bold transition-transform duration-300 group-hover:translate-x-0.5"
          style={{ color: accentDark }}
        >
          Enter
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-300 group-hover:translate-x-1"
          >
            <path
              d="M3 8h10M9 4l4 4-4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </motion.a>
  );
}
