"use client";
import { useState } from "react";

export function CopyPix({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" onClick={() => navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
      className="mt-2 block w-full rounded-lg bg-white px-4 py-2 font-mono text-zinc-800 hover:bg-zinc-100">
      {value} <span className="ml-2 font-sans text-xs text-zinc-500">{copied ? "copiado ✓" : "copiar"}</span>
    </button>
  );
}
