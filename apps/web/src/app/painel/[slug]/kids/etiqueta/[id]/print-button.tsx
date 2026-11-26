"use client";
export function PrintButton() {
  return <button onClick={() => window.print()} className="btn-primary w-full">🖨 Imprimir</button>;
}
