# M02 — Design System

## Цель

Создать единый визуальный и технический фундамент FileFlow для landing page, workspace и всех будущих модулей.

## Результат

После завершения M02 должны быть готовы:

- design tokens;
- light/dark theme;
- typography scale;
- spacing and radius system;
- shadows and surfaces;
- Button;
- Card;
- Badge;
- Input;
- Select;
- Slider;
- Toggle;
- Progress;
- responsive rules;
- accessibility foundation;
- reduced-motion support;
- demo page компонентов.

## Визуальная идея

FileFlow должен восприниматься как приватный, спокойный, технологичный и надёжный продукт.

```text
Warm neutral background
+
Clear blue action color
+
Soft elevated surfaces
+
Strong typography
+
Meaningful motion
```

## Цвета

```text
Background       #F4F3EE
Surface          #FFFFFF
Text primary     #10243F
Text secondary   #66758A
Border           #D9E1EC
Primary          #2F67F6
Primary hover    #2458E8
Primary soft     #EAF1FF
Success          #22A06B
Warning          #D98A24
Danger           #D64545
Purple accent    #7B61FF
```

Dark mode:

```text
Background       #0D1422
Surface          #172235
Surface raised   #1D2A40
Text primary     #EEF4FF
Text secondary   #A2AEC1
Border           #2B3950
Primary          #6E9BFF
```

## Типографика

```text
Display XL   72 / 76
Display L    56 / 60
Heading 1    40 / 46
Heading 2    32 / 38
Heading 3    24 / 30
Heading 4    20 / 26
Body L       18 / 28
Body M       16 / 24
Body S       14 / 20
Caption      12 / 16
Micro        11 / 14
```

## Spacing

Базовая единица — 4px.

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

## Radius

```text
8, 12, 16, 20, 24, 32, full
```

## Компоненты

### Button

Variants:

```text
primary
secondary
ghost
danger
```

Sizes:

```text
sm
md
lg
```

States:

```text
default
hover
active
focus-visible
disabled
loading
```

### Card

Variants:

```text
surface
interactive
selected
glass
```

### Badge

Variants:

```text
local
private
cloud
success
warning
danger
neutral
```

### Form controls

- Input
- Select
- Slider
- Toggle

### Progress

- linear;
- circular;
- indeterminate.

## Accessibility

Обязательно:

- WCAG AA contrast;
- keyboard navigation;
- focus-visible;
- semantic HTML;
- labels;
- aria-live;
- target size не меньше 44×44;
- состояние не передаётся только цветом;
- reduced motion;
- no autoplay sound.

## Theme strategy

```text
data-theme="light"
data-theme="dark"
```

Режимы:

```text
system
light
dark
```

## Responsive breakpoints

```text
sm   640px
md   768px
lg   1024px
xl   1280px
2xl  1440px
```

## Структура

```text
packages/ui/src/
├── button.tsx
├── card.tsx
├── badge.tsx
├── input.tsx
├── select.tsx
├── slider.tsx
├── toggle.tsx
├── progress.tsx
└── index.ts

apps/web/src/app/
├── design-tokens.css
└── design-system/
    └── page.tsx
```

## Что не входит в M02

- landing page;
- drop zone;
- file inspector;
- processing UI;
- backend integration;
- business logic;
- motion orchestration.

## Definition of Done

M02 завершён, если:

- tokens определены;
- light/dark themes работают;
- основные компоненты реализованы;
- focus-visible работает;
- mobile layout проверен;
- reduced motion поддержан;
- demo page доступна;
- lint проходит;
- typecheck проходит;
- tests проходят;
- build проходит;
- документация обновлена.

## Следующий модуль

```text
M03 — Audiovisual Experience System
```
