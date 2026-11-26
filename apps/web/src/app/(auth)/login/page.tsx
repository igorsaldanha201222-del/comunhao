import Link from "next/link";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { login } from "../actions";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-lg font-semibold">{BRAND.name}</Link>
      <h1 className="text-2xl font-semibold">Entrar no painel</h1>
      <ActionForm action={login} className="mt-6 space-y-4" reset={false}>
        <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
        <Field label="E-mail"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
        <Field label="Senha"><input name="password" type="password" required className="input" autoComplete="current-password" /></Field>
        <Submit className="btn-primary w-full">Entrar</Submit>
      </ActionForm>
      <p className="mt-6 text-sm text-zinc-600">
        Ainda não tem conta? <Link href="/cadastro" className="font-medium underline">Cadastre sua igreja</Link>
      </p>
    </main>
  );
}
