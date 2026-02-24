---
title: Frontend Design
description: The frontend design plugin provides skills and patterns for frontend development with modern frameworks.
sidebar:
  order: 13
---

The frontend design plugin is an official Anthropic plugin that extends Claude's frontend development capabilities. It provides structured guidance for building UI components, applying accessibility standards, and following modern frontend patterns -- making Claude a more effective pair programmer for visual and interactive work.

## How It Works

Unlike most CodeForge plugins that use hooks and scripts, this plugin operates as a skill pack. It enriches Claude's knowledge with frontend-specific patterns and best practices that activate when you're working on UI code. The plugin doesn't intercept or modify any operations -- it enhances Claude's ability to generate well-structured frontend code.

## Capabilities

### Component Design

The plugin provides guidance on structuring frontend components following established patterns:

- **Component composition** -- Breaking UIs into reusable, composable pieces with clear prop interfaces
- **Props design** -- Typing props effectively, using sensible defaults, and designing for flexibility
- **State management** -- Choosing between local state, context, stores, and external state based on scope and complexity
- **Accessibility (a11y)** -- ARIA attributes, keyboard navigation, focus management, screen reader support

:::tip[Accessibility by Default]
With this plugin active, Claude considers accessibility from the start rather than treating it as an afterthought. This includes semantic HTML, proper heading hierarchy, focus trapping in modals, and ARIA labels for interactive elements.
:::

### Responsive Design Patterns

Guidance for building layouts that work across screen sizes:

- Mobile-first CSS strategies
- Container queries and breakpoint management
- Fluid typography and spacing
- Touch target sizing and interaction patterns

### Design System Integration

Patterns for working with design systems and component libraries:

- **Token-based styling** -- Using design tokens for colors, spacing, typography, and other values instead of hardcoded CSS
- **Component variants** -- Structuring component APIs with variant props (size, color, emphasis) that map to design system tokens
- **Theme customization** -- Supporting light/dark modes and custom themes through CSS custom properties or framework-specific theming

## Framework Support

The plugin provides general component architecture applicable across frameworks, and complements framework-specific skills available in the [Skill Engine](./skill-engine/):

| Framework | Skill Coverage |
|-----------|---------------|
| **Svelte 5** | Runes, reactivity, component patterns (via Skill Engine) |
| **React** | General component patterns and hooks |
| **Vue** | Composition API patterns |
| **General** | Framework-agnostic architecture, HTML/CSS best practices |

### Example Use Cases

Here are some examples of tasks where the frontend design plugin improves Claude's output:

- **"Build a responsive data table component with sorting and pagination"** -- Claude applies proper ARIA roles for tables, keyboard-navigable sort controls, and responsive overflow handling
- **"Create an accessible modal dialog with focus trapping"** -- Claude includes focus trap logic, escape key handling, proper ARIA attributes, and scroll lock on the body
- **"Design a form component with validation and error states"** -- Claude generates accessible error messages linked to inputs via `aria-describedby`, live region announcements, and proper form semantics
- **"Set up a theme switcher with CSS custom properties"** -- Claude structures tokens hierarchically, respects `prefers-color-scheme`, and persists the preference

## When the Plugin Activates

The frontend design plugin activates whenever Claude is working on frontend code -- HTML, CSS, JavaScript/TypeScript components, or UI-related configuration. You don't need to explicitly invoke it. The plugin's patterns influence code generation, component structure suggestions, and the architectural advice Claude provides.

It works particularly well when combined with the [Skill Engine's](./skill-engine/) framework-specific skills. For example, asking Claude to build a Svelte 5 component benefits from both this plugin's general UI patterns and the Svelte 5 skill's runes-based reactivity knowledge.

## Official Plugin

This plugin is maintained by Anthropic and distributed as part of the Claude Code ecosystem. It receives updates alongside Claude Code itself and is designed to work with Claude's built-in understanding of frontend development.

## Related

- [Skill Engine](./skill-engine/) -- framework-specific skills (Svelte 5, etc.)
- [Skills Reference](../features/skills/) -- all available skills
- [Agent System](./agent-system/) -- agents that handle frontend tasks
