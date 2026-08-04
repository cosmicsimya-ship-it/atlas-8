# RFC-011 — Atlas Persona Engine v1

**Status:** RFC / Vision (Phase 1 scaffold implemented)  
**Document id:** `atlas-rfc-011-persona-engine-v1`  
**Last updated:** 2026-08-02  
**Implementation status:** Phase 1 scaffold + Phase 2 feedback learning

---

## 1. Purpose

Atlas'ı yalnızca cevap üreten bir model olmaktan çıkarıp, Lara'nın düşünme, yazım, editoryal ve sembolik çalışma biçimine zaman içinde uyum sağlayan kişisel bir AI partner katmanına dönüştürmek.

Bu sistem ChatGPT'yi taklit etmez. Amaç Lara'nın uzun vadeli çalışma stilini sürdürmek, geliştirmek ve korumaktır.

---

## 2. Design principles

- Modüler
- LLM'den bağımsız (bilgi dosya tabanlı)
- Prompt-bağımlı olmayan kalıcı katman
- Versiyonlanabilir
- Geriye dönük uyumlu
- Aşamalı uygulanır (tek seferde tüm epic beklenmez)

---

## 3. Layout

```
knowledge/persona-engine/
  persona-engine.json
  voice/
  reasoning/
  editing/
  conversation/
  preferences/
  decision-patterns/
  learning/
  feedback/
  fingerprints/
  symbolic-thinking/

knowledge/author-profile/   # canonical Author Profile (not duplicated)
```

Runtime facade: `server/persona-engine.js`  
Author Profile remains canonical at `knowledge/author-profile/` and is composed by the facade.

---

## 4. Runtime injection order

1. Conversation Style  
2. Persona Engine header  
3. Voice  
4. Author Profile  
5. Reasoning / decision / rejected patterns  
6. Conversation Context (message pipeline)  
7. Current Task  

---

## 5. Phases

| Phase | Scope |
|-------|--------|
| **1** | Scaffold, multi-voice JSON, facade wiring over Author Profile, outbound mechanical guard reuse |
| **2** | Feedback/editing signal capture, scope-aware persistence, runtime resolve (`server/persona-feedback/`) |
| **3** | Content fingerprints + adaptive learning loop |
| **4** | Full reasoning + decision-pattern behavioral influence |

### Phase 2 modules

- `server/persona-feedback/` — extract, editing-delta, store, resolve
- `knowledge/persona-engine/feedback/records.json` — durable candidates/persistent
- Feature flag: `PERSONA_FEEDBACK_LEARNING_ENABLED` (default true; false disables disk writes)

---

## 6. Safety

Persona öğrenmesi:

- kimlik uydurmaz
- kullanıcı adına karar vermez
- kesin hüküm üretmez
- kişisel sınırları aşmaz
- yalnızca davranış ve stil öğrenir

Editorial learning is separated from personal facts in `user_memory`.

---

## 7. Related

- Author Profile: `server/author-profile.js`, `knowledge/author-profile/`
- Conversation style: `server/atlas-conversation-style.js`
- Conversation context: `server/conversation-context-engine.js`
- Symbolic synthesis: `server/symbolic-synthesis.js`, `server/cross-layer-synthesis/`
