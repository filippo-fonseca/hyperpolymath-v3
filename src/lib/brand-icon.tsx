import { ImageResponse } from "next/og";

// App icon: the serif "H" monogram on paper, matching the wordmark. Rendered
// at build time; falls back to the default font if Google Fonts is unreachable.

async function garamond(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=EB+Garamond:wght@500&text=H")).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export async function monogram(size: number, opts: { rounded?: boolean } = {}) {
  const font = await garamond();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fcfcfc",
          color: "#141414",
          borderRadius: opts.rounded ? size * 0.22 : 0,
          fontFamily: font ? "EB Garamond" : "serif",
          fontSize: size * 0.68,
          lineHeight: 1,
          paddingBottom: size * 0.04,
        }}
      >
        H
      </div>
    ),
    {
      width: size,
      height: size,
      fonts: font ? [{ name: "EB Garamond", data: font, weight: 500, style: "normal" }] : undefined,
    },
  );
}
