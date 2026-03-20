# Escola de Ministros

Plataforma web de ensino para gestão de turmas, módulos, aulas em vídeo e acompanhamento do progresso dos alunos.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- YouTube IFrame Player API

## O que já está pronto

- Cadastro, login e controle de perfil por papel (`admin` e `aluno`)
- Entrada do aluno por código da turma
- Onboarding inicial com dias e horário de estudo
- Painel admin com:
  - criação de turmas
  - capa, categoria e código automático
  - criação, edição e exclusão de módulos
  - criação e edição de aulas
  - bloqueio/liberação de aulas
  - progresso dos alunos por turma
- Área do aluno com:
  - dashboard `Minhas Aulas`
  - visualização de aulas liberadas
  - player do YouTube embutido
  - conclusão manual e automática da aula
  - conta do aluno com foto de perfil e rotina de estudo

## Fluxos principais

### Admin

- cria turma
- organiza módulos
- publica aulas por link do YouTube
- acompanha progresso dos alunos

### Aluno

- cria conta
- informa código da turma
- configura rotina de estudo
- acessa dashboard
- assiste aulas e registra progresso

## Rodando localmente

Crie um arquivo `.env.local` com as variáveis do Supabase e execute:

```bash
npm install
npm run dev
```

Depois abra:

```text
http://localhost:3000
```

## Observações

- Vídeos são carregados por URL do YouTube não listado.
- Upload de avatar usa Supabase Storage.
- Algumas telas de acompanhamento e refinamentos visuais ainda estão em evolução.
