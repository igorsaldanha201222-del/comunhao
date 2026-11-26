import Link from "next/link";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { signupChurch } from "../actions";

export const metadata = { title: "Cadastrar igreja" };

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-8 text-lg font-semibold">{BRAND.name}</Link>
      <h1 className="text-2xl font-semibold">Cadastre sua igreja</h1>
      <p className="mt-1 text-sm text-zinc-500">Você será o responsável pela conta e poderá convidar sua equipe depois.</p>
      <ActionForm action={signupChurch} className="mt-6 space-y-4" reset={false}>
        <Field label="Seu nome"><input name="full_name" required className="input" /></Field>
        <Field label="E-mail"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
        <Field label="Senha (mín. 8 caracteres)"><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
        <hr className="border-zinc-200" />
        <Field label="Nome da igreja"><input name="church_name" required className="input" /></Field>
        <Field label="Código da igreja (usado no app e no endereço do site)">
          <input name="slug" required pattern="[a-z0-9\-]{3,40}" placeholder="ex.: igreja-esperanca" className="input" />
        </Field>
        <Submit className="btn-primary w-full">Criar conta</Submit>
      </ActionForm>
      <p className="mt-6 text-sm text-zinc-600">
        Já tem conta? <Link href="/login" className="font-medium underline">Entrar</Link>
      </p>
    </main>
  );
}
