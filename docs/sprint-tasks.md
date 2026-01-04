# 📋 2-Week Sprint: MVP Breakdown (Jira-style)

### 🟢 Epic: AI Collaborative Canvas (MVP)

**Goal**: Build the first version of GenPlace.ai (AI collaborative canvas) with prompt → generate → place image on a point grid + cooldown system.

---

### 🔧 Backend Tasks

1. **User Authentication**
   - Task: Set up JWT-based auth (email login or social OAuth).
   - Est: 0.5d
2. **Token/Cooldown System**
   - Task: Implement token bucket logic (X tokens, refill every Y min).
   - Est: 1d
3. **Slot & Placement Model**
   - Task: DB schema for slots (id, coords, placement_id) + placements (image URL, prompt, user).
   - Est: 1d
4. **Generate API Integration**
   - Task: Connect to Stable Diffusion / OpenAI image gen API.
   - Task: Support 128×128 and 256×256 output.
   - Est: 1.5d
5. **Moderation Integration**
   - Task: Use provider safety filters.
   - Task: Add “reject reason” return path.
   - Est: 1d
6. **Placement Pipeline**
   - Task: Save approved images, update slot, write image to S3.
   - Task: Trigger WebSocket event for clients.
   - Est: 1.5d
7. **WebSocket Service**
   - Task: WS endpoint for subscribing to point updates.
   - Task: Push diff events on placement.
   - Est: 2d

---

### 🎨 Frontend Tasks

1. **Canvas Grid UI**
   - Task: Zoomable/pannable grid with slots (Leaflet/Mapbox).
   - Task: Show placed images in points.
   - Est: 2d
2. **Prompt Form**
   - Task: Input box for prompt, size dropdown.
   - Task: POST request to /generate.
   - Est: 1d
3. **Cooldown Display**
   - Task: Show tokens remaining + timer until next regen.
   - Est: 0.5d
4. **Live Updates**
   - Task: Connect to WebSocket, update canvas in real-time when diff event arrives.
   - Est: 1.5d
5. **Placement Details Modal**
   - Task: On click, show prompt, author, timestamp.
   - Est: 0.5d

---

### 🧪 QA & Infra

1. **Basic Reporting**
   - Task: Add “Report Image” button → POST /report.
   - Est: 0.5d
2. **Deployment Pipeline**
   - Task: Dockerize services.
   - Task: Deploy to AWS/GCP with S3 + CDN for images.
   - Est: 2d
3. **Smoke Testing**
   - Task: Test prompt → generate → approve → place → live update flow.
   - Est: 1d

---

⏱ **Total Estimate**: ~13–14 days → achievable in a 2-week sprint with 2–3 devs.
