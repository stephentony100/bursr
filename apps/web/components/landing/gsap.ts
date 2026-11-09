"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { CustomEase } from "gsap/CustomEase";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// One place to register GSAP plugins for the home page. GSAP 3.15 (Standard
// no-charge license) with ScrollTrigger, SplitText and CustomEase, the same
// stack the reference sites use.
gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText, CustomEase);

// Two eases defined as custom curves, the way Stax.ai defines theirs.
CustomEase.create("snappy", "M0,0 C0.094,0.026 0.124,0.127 0.157,0.29 0.197,0.486 0.254,0.8 0.348,0.884 0.42,0.949 0.374,1 1,1");
CustomEase.create("unmask", "M0,0 C0.16,1 0.3,1 1,1");

export { gsap, ScrollTrigger, SplitText, useGSAP };

export const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
