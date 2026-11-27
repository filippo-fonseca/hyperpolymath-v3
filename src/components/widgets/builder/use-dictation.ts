"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Speak a brief instead of typing it: the browser's own speech recognition
// (Chrome, Edge, Safari). Nothing leaves the browser through this app.

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function ctor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

/** Dictation into a text value: final phrases are appended, the live phrase is shown as `interim`. */
export function useDictation(onText: (text: string) => void) {
  const supported = useSyncExternalStore(noSubscribe, () => !!ctor(), () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  useEffect(() => {
    cb.current = onText;
  }, [onText]);

  const stop = useCallback(() => {
    rec.current?.stop();
  }, []);

  const start = useCallback(() => {
    const C = ctor();
    if (!C) return;
    const r = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || "en-US";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
    };
    r.onerror = () => r.stop();
    rec.current = r;
    setListening(true);
    r.start();
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, interim, start, stop };
}
