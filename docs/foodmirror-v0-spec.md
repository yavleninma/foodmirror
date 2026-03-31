# FoodMirror v0

## Positioning

FoodMirror v0 is a personal AI nutrition tracker for a small real-world group, starting with two active users.

The product goal is simple:

- capture food quickly from a photo
- estimate calories and macros accurately enough to be useful
- allow fast correction
- save the truth of the day without coaching or judgment

## Core entities

### Food entry

- one uploaded photo equals one food draft / record
- contains photo, title, calories, protein, fat, carbs
- belongs to a single day
- can be edited after saving
- can be moved to another day
- can be added again from history

### Weight entry

- separate entity from food
- one value in kilograms
- saved for any chosen day
- visible in day history and calendar statistics

### Draft

- created from Telegram or web upload
- stores photo and AI output before final save
- can be edited and then saved into food history

## Confidence model

Allowed values:

- `confident` -> "Уверенно" / "Confident"
- `normal` -> "Нормально" / "Normal"
- `check` -> "Стоит проверить" / "Worth checking"
- `unsure` -> "Неуверенно" / "Uncertain"

## Technical direction

- static SPA shell + Vercel serverless API
- Upstash Redis REST for production persistence
- local JSON fallback for development
- OpenAI Vision analysis through API routes
- Telegram webhook that creates drafts and deep-links into the app
