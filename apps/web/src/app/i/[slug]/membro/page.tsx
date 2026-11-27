import { redirect } from "next/navigation";

// A jornada de membro agora fica no app: quem chega aqui vai para a entrada da igreja no app.
export default async function QueroSerMembro({ params }: PageProps<"/i/[slug]/membro">) {
  const { slug } = await params;
  redirect(`/app/bem-vindo?c=${encodeURIComponent(slug)}`);
}
