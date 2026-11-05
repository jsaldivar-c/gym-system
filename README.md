# gym-system

Sistema de gestión para gimnasios: clientes, membresías, pagos y vencimientos. Empieza con un solo gimnasio y está diseñado para crecer a varios.

## Estructura

```
gym-system/
├─ web/      Frontend: React + Vite + TypeScript (fase 1)
├─ api/      Backend: Node + Express + TypeScript + Prisma
├─ docs/     Brief, modelo de datos, ADRs, guía de aprendizaje e investigación
└─ .github/  Plantilla de PR, CI y Dependabot
```

## Documentación

- [Brief del proyecto](docs/brief.md): visión, usuarios, fases y reglas de negocio
- [Modelo de datos](docs/modelo-datos.md): diagrama ER, diccionario y vista de estado
- [Decisiones de arquitectura (ADRs)](docs/adr/README.md)
- [Guía de aprendizaje](docs/aprendizaje.md)
- [Benchmark de software de gimnasios](docs/reports/Software%20de%20gestión%20de%20gimnasios.md)

## Requisitos

- Node.js 22 o superior
- Una cuenta de Supabase (fase 1)

## Comandos (api)

```bash
cd api
npm install
cp .env.example .env    # y llena los valores
npm run prisma:validate
```

## Flujo de trabajo

`main` está protegida: todo cambio entra por Pull Request con la CI en verde.

1. `git switch -c feat/descripcion-corta`
2. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(api): ...`, `docs: ...`
3. `git push -u origin feat/descripcion-corta` y abrir el PR
4. Merge cuando la CI pase, y luego borrar la rama
