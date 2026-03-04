# AI SDK Svelte — Reference

## Mental Model

The `@ai-sdk/svelte` package provides class-based state management for AI-powered UI. Three classes cover the primary use cases: `Chat` for conversational interfaces, `Completion` for single-prompt text generation, and `StructuredObject` for streaming typed JSON. Each class encapsulates connection state, loading indicators, error handling, and the accumulated response — eliminating manual fetch/state synchronization.

These classes integrate with Svelte 5 reactivity through their properties. Instances expose reactive properties (messages, input, status, error) that update as the server streams tokens. The classes handle the streaming protocol internally; component code reads properties and calls methods.

> Official documentation covers server-side route handlers, provider configuration, and model selection: <https://sdk.vercel.ai/docs>

---

## Core Classes

### Chat

Manages a multi-turn conversation with message history, automatic input handling, and abort support.

```svelte
<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';

  const chat = new Chat({ api: '/api/chat' });
</script>

<ul>
  {#each chat.messages as message}
    <li>{message.role}: {message.content}</li>
  {/each}
</ul>

<form onsubmit={chat.handleSubmit}>
  <input bind:value={chat.input} />
  <button type="submit">Send</button>
</form>
```

Key properties: `messages`, `input`, `status`, `error`, `isLoading`.
Key methods: `handleSubmit`, `append`, `reload`, `stop`, `setMessages`.

### Completion

Manages single-prompt text completion without message history.

```js
import { Completion } from '@ai-sdk/svelte';

const completion = new Completion({ api: '/api/completion' });
// completion.completion — the generated text
// completion.complete(prompt) — trigger generation
```

### StructuredObject

Streams a typed JSON object as tokens arrive, providing partial results during generation.

```js
import { StructuredObject } from '@ai-sdk/svelte';

const obj = new StructuredObject({ api: '/api/object', schema: myZodSchema });
// obj.object — the (partial) parsed object
// obj.submit(input) — trigger generation
```

---

## Shared State with createAIContext

`createAIContext()` shares a `Chat` (or other class) instance across a component subtree via Svelte context, avoiding prop drilling for chat UIs split across message list, input, and status components.

```js
// Layout or parent component
import { createAIContext } from '@ai-sdk/svelte';

const context = createAIContext({ chat: new Chat({ api: '/api/chat' }) });
```

Descendant components retrieve the shared instance with `getAIContext()`.

---

## Svelte 5 Integration

### Pass Getters for Reactive Options

Script blocks in Svelte 5 run once. Constructor options that depend on reactive values must use getter syntax so the class reads the current value on each access:

```svelte
<script>
  let model = $state('gpt-4o');

  // Correct — getter re-evaluates on each internal read
  const chat = new Chat({
    api: '/api/chat',
    body: { get model() { return model; } }
  });

  // Wrong — captures the initial value of model, never updates
  const chat2 = new Chat({
    api: '/api/chat',
    body: { model: model }
  });
</script>
```

### Do Not Destructure Reactive Properties

Class instances expose reactive properties through getters on the prototype. Destructuring copies the current value into a plain variable, severing reactivity:

```js
// Wrong — greeting loses reactivity
const { messages, input } = chat;

// Correct — always read from the instance
chat.messages
chat.input
```

### Reactive State for Custom Data Alongside Chat

Combine `$state` with Chat class properties freely. The Chat instance manages its own reactivity; local `$state` handles additional UI concerns:

```svelte
<script>
  const chat = new Chat({ api: '/api/chat' });
  let sidebarOpen = $state(false);
</script>
```
