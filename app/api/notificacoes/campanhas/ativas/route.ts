import { NextRequest, NextResponse } from "next/server";
import { autenticarRequest } from "@/lib/server-auth";
import { buscarCampanhaParaAluno } from "@/lib/server-campanhas-notificacao";

export async function GET(request: NextRequest) {
  try {
    const autenticacao = await autenticarRequest(request);
    if (autenticacao.error || !autenticacao.usuario) {
      return NextResponse.json({ error: autenticacao.error }, { status: 401 });
    }

    if (autenticacao.role !== "aluno") return NextResponse.json({ campanha: null });

    const campanha = await buscarCampanhaParaAluno(autenticacao.usuario.id);
    return NextResponse.json({ campanha });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Nao foi possivel carregar os avisos." },
      { status: 500 },
    );
  }
}
