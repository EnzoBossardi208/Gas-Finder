# GasFinder RS

Plataforma web para comparar preços de combustível em **Vera Cruz** e **Santa Cruz do Sul** (RS).

## Versão

**v1.1.0** — app funcional com autenticação Supabase, papéis (motorista / dono / admin), PWA e tema claro/escuro.

## Funcionalidades

- Login, cadastro e seleção de perfil
- Busca por cidade, nome, geolocalização e filtros
- Favoritos, comparador e relatório de preços
- Painel do posto parceiro (preços e promoções)
- Painel administrador master
- Perfil do usuário e tema claro/escuro
- PWA (instalável + service worker)

## Tecnologias

- HTML, CSS, JavaScript
- Supabase (Auth + banco)
- Service Worker / Manifest (PWA)

## Como abrir

Abra `index.html` em um servidor local (recomendado) ou via extensão Live Server no VS Code/Cursor.

## Observações

- Admin: `suporte@gasfinder.com`
- Relatórios colaborativos dependem das políticas RLS do Supabase
- Para push remoto, configure a chave VAPID em `app.js`
