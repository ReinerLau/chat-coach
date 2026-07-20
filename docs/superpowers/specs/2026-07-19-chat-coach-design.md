# chat-coach Design Spec

## Overview

chat-coach is a chat reply coach bot running on Feishu bridge (Claude Code). It helps the user generate natural-sounding reply suggestions based on chat context with individual contacts.

**Core problem**: User spends too much time thinking about what to say in online chats, or doesn't know what to say at all.

**Platform**: Feishu bot via lark-channel-bridge — zero deployment, zero additional cost.

**Anti-goals**: No Feishu Open Platform app creation, no backend service, no database, no frontend, no Claude API integration (bridge handles everything).

## Data Model

Each contact stored as a JSON file: `data/contacts/<name>.json`

```json
{
  "name": "小王",
  "tags": ["大学同学", "关系一般"],
  "goal": "保持联系，有机会约饭",
  "history": [
    {"role": "them", "content": "最近怎么样？", "time": "2026-07-15"},
    {"role": "me", "content": "还行，忙工作", "time": "2026-07-15"}
  ],
  "notes": "最近刚换工作去了字节",
  "last_contact": "2026-07-18",
  "remind_interval_days": 7
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| name | string | Contact display name |
| tags | string[] | Relationship and identity labels; influence reply style |
| goal | string | User's goal for this relationship; guides reply tone and direction |
| history | object[] | Chat log, ordered by time; each entry has `role` (them/me), `content`, `time` |
| notes | string | Free-form notes about this person |
| last_contact | date | Date of last interaction |
| remind_interval_days | number | Days without contact before bot suggests reaching out |

## Commands (Bot Interface)

The user interacts via Feishu private chat with the bot:

**Contact Management**
- `/add <name>` — Add a new contact
- `/tag <name> <tags...>` — Set relationship tags
- `/goal <name> <description>` — Set relationship goal
- `/note <name> <content>` — Add a note
- `/remind <name> <days>` — Set reminder interval
- `/list` — List all contacts with status
- `/info <name>` — Show full contact profile

**Chat History**
- `/log <name> <text>` — Append conversation to contact's history
- `/history <name>` — View chat history with this contact

**Core Feature**
- `/reply <name>` — Generate 2-3 reply suggestions with different styles (casual / formal / relationship-advancing) based on recent chat context and contact profile

## Project Structure

```
chat-coach/
├── CLAUDE.md                 # Bot behavior spec (role, reply rules, anti-AI constraints)
├── data/
│   └── contacts/
│       ├── 小王.json
│       └── ...
└── scripts/
    └── coach.py              # Helper: CRUD contact files, format output
```

`coach.py` handles: JSON file read/write, contact listing, history formatting. Claude Code reads data files and executes commands directly; no API calls needed.

## Core Prompt Design (Anti-AI Voice)

The reply generation prompt is the most critical component. It must produce text that reads as "what a normal person would say" — NOT as an AI-generated response.

### Hard Constraints (from companion doc)

| Dimension | AI Pattern (avoid) | Natural Pattern (target) |
|-----------|-------------------|-------------------------|
| Length | Every reply similar length, always complete sentences | Short when appropriate ("行", "好"), long only when needed |
| Tone | Overly polite, overly enthusiastic, fake positivity | Match relationship distance — casual with friends, restrained with bosses |
| Word choice | Formal written language, no colloquialisms | Heavy use of spoken words (呗, 嘛, 吧, 哈哈, 嗯, 哦, 害, 我去) |
| Structure | Template-like: state opinion → expand → wrap up | No fixed pattern, break expectations |
| Grammar | Always perfect, punctuation complete | Allow omitted subjects, incomplete sentences, no periods |
| Emotion | Always positive, always understanding, always supportive | Allow teasing, genuine reactions, "imperfect" emotions |
| Advancement | Passive response, never pushing the relationship forward | Invite when appropriate, ask back when curious |

### Banned AI Phrases

Words/phrases to explicitly forbid in prompts: "当然可以", "很高兴为您", "综上所述", "请问", "非常抱歉", "感谢您的理解", "期待与您", "欣然接受"

### Multi-Style Output

Each `/reply` generates 2-3 variants tagged by style:
- **随意** (casual) — relaxed, short, colloquial
- **正式** (formal) — polite but not stiff, for professional contexts
- **推进关系** (relationship-advancing) — moves toward the stated goal

## Usage Flow

1. User sees a message on WeChat they don't know how to reply to
2. User copies the conversation, opens Feishu, DMs the chat-coach bot
3. User pastes context: `/log 小王 对方: 周末有空吗 / 我: [need reply]`
4. Bot reads contact profile + history, generates 2-3 natural reply options
5. User picks one, sends it on WeChat

## Reminder Feature

Bot checks `last_contact` + `remind_interval_days` when user asks `/list` or `/reply`. If a contact hasn't been interacted with past the interval, bot surfaces a reminder: "小王 7 天没联系了，要不要主动打个招呼？"

## Scope Boundaries

**In scope**:
- Contact CRUD via bot commands
- Chat history logging
- Multi-style reply generation with anti-AI constraints
- Reminder prompts based on contact intervals

**Out of scope**:
- Feishu Open Platform app (uses bridge instead)
- Claude API integration (uses Claude Code via bridge)
- WeChat integration (manual copy-paste flow)
- Multi-user support (single user: ReinerLau)
- Authentication system
- Real-time chat monitoring
