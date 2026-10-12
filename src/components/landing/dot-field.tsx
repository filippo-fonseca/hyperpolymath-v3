"use client";

import { useEffect, useRef } from "react";

// A faint dot grid behind the hero. Dots near a mouse pointer grow a little,
// darken and lean away from it, then ease back when it leaves. One canvas,
// redrawn only while the pointer moves or dots are settling, and never while
// the hero is offscreen or the tab is hidden. Touch screens and reduced motion
// get the same grid, drawn once and left still.

const GAP = 24;
const DOT = 1;
const RADIUS = 140;
const PUSH = 6;
const GROW = 1.1;
const BASE_ALPHA = 0.15;
const HOT_ALPHA = 0.3;
const EASE = 0.16;
const TAU = Math.PI * 2;

export function DotField({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const interactive =
      window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let cols = 0;
    let rows = 0;
    let ox = 0;
    let oy = 0;
    let influence = new Float32Array(0);
    // Pointer in canvas coordinates. It is kept after the pointer leaves so
    // dots ease back along the same direction they were pushed.
    let px = 0;
    let py = 0;
    let present = false;
    let clientX = 0;
    let clientY = 0;
    let raf = 0;
    let onScreen = true;

    function draw(): boolean {
      ctx!.clearRect(0, 0, w, h);
      let settling = false;
      const hot: number[] = [];

      ctx!.fillStyle = `rgba(20,20,20,${BASE_ALPHA})`;
      ctx!.beginPath();
      for (let j = 0; j < rows; j++) {
        const y = oy + j * GAP;
        for (let i = 0; i < cols; i++) {
          const x = ox + i * GAP;
          const k = j * cols + i;
          let target = 0;
          if (present) {
            const dx = x - px;
            const dy = y - py;
            const d2 = dx * dx + dy * dy;
            if (d2 < RADIUS * RADIUS) {
              const t = 1 - Math.sqrt(d2) / RADIUS;
              target = t * t * (3 - 2 * t);
            }
          }
          const cur = influence[k];
          let next = cur + (target - cur) * EASE;
          if (Math.abs(target - next) < 0.003) next = target;
          else settling = true;
          influence[k] = next;
          if (next < 0.01) {
            ctx!.moveTo(x + DOT, y);
            ctx!.arc(x, y, DOT, 0, TAU);
          } else hot.push(k);
        }
      }
      ctx!.fill();

      for (const k of hot) {
        const v = influence[k];
        const x = ox + (k % cols) * GAP;
        const y = oy + Math.floor(k / cols) * GAP;
        const dx = x - px;
        const dy = y - py;
        const d = Math.hypot(dx, dy) || 1;
        ctx!.fillStyle = `rgba(20,20,20,${BASE_ALPHA + (HOT_ALPHA - BASE_ALPHA) * v})`;
        ctx!.beginPath();
        ctx!.arc(x + (dx / d) * PUSH * v, y + (dy / d) * PUSH * v, DOT + GROW * v, 0, TAU);
        ctx!.fill();
      }
      return settling;
    }

    function frame() {
      raf = 0;
      if (draw() && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }
    function kick() {
      if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(w / GAP) + 1;
      rows = Math.ceil(h / GAP) + 1;
      ox = (w - (cols - 1) * GAP) / 2;
      oy = GAP / 2;
      influence = new Float32Array(cols * rows);
      draw();
    }

    function track() {
      const rect = canvas!.getBoundingClientRect();
      px = clientX - rect.left;
      py = clientY - rect.top;
      present = px > -RADIUS && py > -RADIUS && px < w + RADIUS && py < h + RADIUS;
      kick();
    }
    function onMove(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      clientX = e.clientX;
      clientY = e.clientY;
      track();
    }
    function onLeave() {
      present = false;
      kick();
    }
    function onScroll() {
      if (present) track();
    }
    function onVisibility() {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else kick();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    if (!interactive) return () => ro.disconnect();

    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (onScreen) kick();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} />;
}
