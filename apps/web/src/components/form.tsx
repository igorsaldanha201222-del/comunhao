"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type ActionResult = { error?: string; ok?: string } | undefined;
export type FormAction = (prev: ActionResult, data: FormData) => Promise<ActionResult>;

/** Formulário de Server Action com mensagem de erro/sucesso e reset após salvar. */
export function ActionForm({
  action,
  children,
  className,
  reset = true,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  reset?: boolean;
}) {
  const [state, run] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && reset) ref.current?.reset();
  }, [state, reset]);
  return (
    <form ref={ref} action={run} className={className}>
      {children}
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="mt-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}

export function Submit({ children, className = "btn-primary" }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? "Salvando…" : children}
    </button>
  );
}

/** Botão que confirma antes de enviar (ex.: excluir). */
export function ConfirmButton({ children, message, className = "btn-danger" }: { children: ReactNode; message: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
