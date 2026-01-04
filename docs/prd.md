# 📄 One-Page PRD: GenPlace.ai MVP

### Product Name

**GenPlace.ai** (working title)

### Vision

A collaborative online canvas where anyone can generate AI images from prompts and place them onto a shared map grid. Inspired by r/Place and Wplace, but powered by generative AI for instant creativity.

### Goals

- Launch MVP in 2 weeks.
- Allow users to:
  1. Log in,
  2. Enter a text prompt,
  3. Generate an AI image (128–256px),
  4. Place it in an empty slot,
  5. See it appear in real-time.
- Enforce cooldowns to control costs & spam.
- Provide minimal moderation (provider filters + reporting).

### Non-Goals (MVP)

- Large image sizes (512+).
- Mobile apps.
- Leaderboards, likes, or social features.
- Complex moderation or time-lapse features.

### User Stories

1. As a **new user**, I can sign up and get X tokens.
2. As a **player**, I can input a prompt and generate a 128–256px image.
3. As a **player**, I can place my image into a grid slot (if I have tokens).
4. As a **viewer**, I see updates in real-time when others place images.
5. As a **viewer**, I can click an image to see who made it and when.
6. As a **user**, I cannot spam — I must wait until my cooldown regenerates tokens.
7. As a **user**, I can report an inappropriate image.

### Success Metrics

- DAU (Daily Active Users).

# of prompts generated / day.

- Average time spent on canvas.
- Viral shares (social screenshots / mentions).

### Tech Notes

- **Frontend**: React/Next.js, Leaflet (map grid).
- **Backend**: Node/Python API, Redis for token buckets, Postgres for placements.
- **Image Gen**: Stable Diffusion API (fallback OpenAI DALL·E).
- **Storage/CDN**: AWS S3 + CloudFront.
- **Realtime**: WebSockets (via Ably or self-hosted).
