-- Campanhas administrativas de notificacao.
-- Execute este arquivo uma unica vez no SQL Editor do Supabase.

-- Caixa de entrada individual usada pelo sino do aluno.
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensagem text not null,
  acao_tipo text null,
  acao_payload jsonb null,
  visualizada boolean not null default false,
  modal_exibido_em timestamptz null,
  criado_em timestamptz not null default now()
);

create index if not exists notificacoes_usuario_criado_idx
  on public.notificacoes (usuario_id, criado_em desc);

create index if not exists notificacoes_usuario_visualizada_idx
  on public.notificacoes (usuario_id, visualizada);

alter table public.notificacoes enable row level security;

drop policy if exists "usuario ve suas notificacoes" on public.notificacoes;
create policy "usuario ve suas notificacoes"
  on public.notificacoes
  for select
  using (usuario_id = auth.uid());

drop policy if exists "usuario atualiza suas notificacoes" on public.notificacoes;
create policy "usuario atualiza suas notificacoes"
  on public.notificacoes
  for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create table if not exists public.campanhas_notificacao (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  mensagem text not null,
  tema text not null default 'aviso' check (tema in ('informacao', 'aviso', 'urgente')),
  publico_tipo text not null default 'todos' check (publico_tipo in ('todos', 'turma', 'progresso_incompleto')),
  turma_id uuid null references public.turmas(id) on delete cascade,
  inicio_em timestamptz not null,
  fim_em timestamptz not null,
  frequencia_dia smallint not null default 1 check (frequencia_dia between 1 and 6),
  exibir_sobre_tela boolean not null default true,
  acao_rotulo text null,
  acao_rota text null,
  ativa boolean not null default true,
  criado_por uuid null references public.usuarios(id) on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint campanhas_notificacao_periodo_valido check (fim_em > inicio_em),
  constraint campanhas_notificacao_turma_valida check (
    publico_tipo <> 'turma' or turma_id is not null
  )
);

alter table public.notificacoes
  add column if not exists campanha_id uuid null references public.campanhas_notificacao(id) on delete set null;

create unique index if not exists notificacoes_campanha_usuario_uidx
  on public.notificacoes (campanha_id, usuario_id);

create table if not exists public.exibicoes_notificacao (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  usuario_id uuid not null references public.usuarios(id) on delete cascade,
  data_local date not null default ((timezone('America/Sao_Paulo', now()))::date),
  exibido_em timestamptz not null default now(),
  dispensado_em timestamptz null
);

create index if not exists exibicoes_notificacao_usuario_data_idx
  on public.exibicoes_notificacao (usuario_id, data_local, exibido_em desc);

alter table public.campanhas_notificacao enable row level security;
alter table public.exibicoes_notificacao enable row level security;

drop policy if exists "admin gerencia campanhas de notificacao" on public.campanhas_notificacao;
create policy "admin gerencia campanhas de notificacao"
  on public.campanhas_notificacao
  for all
  using (
    exists (
      select 1 from public.usuarios
      where usuarios.id = auth.uid() and usuarios.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.usuarios
      where usuarios.id = auth.uid() and usuarios.role = 'admin'
    )
  );

drop policy if exists "usuario ve suas exibicoes de notificacao" on public.exibicoes_notificacao;
create policy "usuario ve suas exibicoes de notificacao"
  on public.exibicoes_notificacao
  for select
  using (usuario_id = auth.uid());

-- Primeira campanha solicitada. O horario abaixo equivale a 23:59 em Sao Paulo.
insert into public.campanhas_notificacao (
  titulo,
  mensagem,
  tema,
  publico_tipo,
  inicio_em,
  fim_em,
  frequencia_dia,
  exibir_sobre_tela,
  acao_rotulo,
  acao_rota,
  ativa
)
select
  'Conclua suas aulas ate sexta-feira',
  'As aulas ficarao abertas somente ate sexta-feira. Conclua as etapas pendentes dentro do prazo.',
  'aviso',
  'progresso_incompleto',
  now(),
  '2026-07-24 23:59:00-03'::timestamptz,
  1,
  true,
  'Ver aulas agora',
  '/dashboard',
  true
where now() < '2026-07-24 23:59:00-03'::timestamptz
  and not exists (
    select 1
    from public.campanhas_notificacao
    where titulo = 'Conclua suas aulas ate sexta-feira'
      and fim_em = '2026-07-24 23:59:00-03'::timestamptz
  );
