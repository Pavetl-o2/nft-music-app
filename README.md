# SOUNDFORGE — NFT Music Game

Prototipo de aplicación web para el juego NFT de música generativa.

## Stack

- **Next.js 14** (App Router)
- **Supabase** (base de datos + autenticación)
- **Tailwind CSS** (estilos)
- **Framer Motion** (animaciones)
- **ACE-Step** vía RunPod (generación de música)
- **Gemini 2.5 Flash** vía OpenRouter (generación de letras)

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Copia `.env.example` a `.env.local` y rellena:

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
ACESTEP_BASE_URL=https://tu-pod-8001.proxy.runpod.net
OPENROUTER_API_KEY=tu_openrouter_key
```

### 3. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve al SQL Editor y ejecuta `supabase_schema.sql`
3. Importa los personajes:

```bash
node scripts/import_to_supabase.cjs
```

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Flujo de la app

1. **Landing** (`/`) — Conectar wallet o entrar en modo demo
2. **Colección** (`/collection`) — Seleccionar 3 NFTs (Ritmo + Melodía + Vocales)
3. **Fusión** (`/fuse`) — Generar canción con IA y escuchar el resultado

## Generación de personajes

Para regenerar los 333 personajes:

```bash
# Desde la raíz del repositorio nft-music
node generate_characters.cjs
```

## Deploy en Vercel

```bash
vercel --prod
```

Asegúrate de agregar todas las variables de entorno en el dashboard de Vercel.

## Notas del prototipo

- La conexión de wallet es simulada (modo demo)
- Los personajes en `/collection` son una muestra hardcodeada de 18 personajes
- Para producción, cargar desde Supabase según los NFTs del wallet del usuario
- ACE-Step requiere RunPod activo para generar música
