# Cross-Vendor Skill Authoring Principles

This reference synthesizes prompt engineering and skill authoring principles from three major AI vendors: Anthropic (Claude), OpenAI (GPT/ChatGPT), and Google (Gemini). Principles are organized by theme, with vendor attribution, to reveal convergence and highlight vendor-specific insights.

## 1. Context Management and Token Economy

### Anthropic
- **Attention budget.** Every token consumes attention. Maximize signal-to-noise ratio. Remove anything that does not change behavior.
- **Progressive disclosure.** Three tiers: metadata (~100 words, always loaded), SKILL.md body (<5k words, loaded on activation), bundled resources (loaded on demand). Load only what is needed, when it is needed.
- **Just-in-time context.** Defer loading detailed reference material until the model determines it is relevant. Avoid frontloading large documents.

### OpenAI
- **System prompt sections.** Structure system prompts into clear sections: Identity, Instructions, Output Format, Examples, Context. Each section serves a distinct purpose and can be independently maintained.
- **Combine sequential functions.** When two functions are always called in sequence, combine them into one to reduce overhead.
- **Fewer high-relevance examples.** Two or three precisely targeted examples outperform ten loosely related ones.

### Google/Gemini
- **Precision over verbosity.** Shorter, more precise instructions outperform longer, vaguer ones. Remove filler and hedge words.
- **Structure matters.** Place context first, instructions in the middle, constraints last. This ordering aligns with how models process sequential input.
- **Delegate deterministic work.** Offload deterministic operations to scripts. Reserve the model's reasoning capacity for tasks requiring judgment.

### Unified Principle
Treat context as a scarce resource. Load information progressively, structure it for efficient parsing, and delegate deterministic work to scripts. Every token should earn its place.

---

## 2. Instruction Framing

### Anthropic
- **Positive framing.** Tell what to DO, not what NOT to do. Negations cause the model to fixate on the prohibited behavior, increasing the likelihood of exhibiting it.
- **Why behind what.** Explain the rationale for instructions. Instructions with reasoning attached are followed more reliably because the model can generalize the underlying principle.
- **Altitude calibration (Goldilocks zone).** Instructions must be specific enough to change behavior but flexible enough to allow the model's own heuristics. Too specific causes brittleness; too vague produces generic output.

### OpenAI
- **Imperative, step-by-step.** Write instructions as clear sequential steps in imperative form. Numbered steps for procedures, bullet points for parallel options.
- **Eliminate contradictions.** Contradictory instructions force the model to choose between them, wasting reasoning capacity and producing unpredictable results.
- **The Intern Test.** Could someone with no project context follow these instructions to produce the desired result? If not, the instructions lack sufficient detail or clarity.

### Google/Gemini
- **Positive instructions.** Avoid broad negations. "Do not" instructions cause over-indexing -- the model allocates disproportionate attention to the negated behavior. Reframe as positive directives.
- **Examples beat rules.** A well-chosen example communicates constraints, format, and style simultaneously. Rules require interpretation; examples are unambiguous.
- **Explicit ambiguity policy.** Define when the model should assume a default versus when it should ask for clarification. Undefined ambiguity policy creates inconsistent behavior.

### Unified Principle
Frame instructions positively, in imperative form, with rationale attached. Use examples to demonstrate expected behavior. Define how to handle ambiguity. Test instructions against the Intern Test for clarity. Aim for the altitude that guides without constraining.

---

## 3. Description and Routing

### Anthropic
- **Descriptions determine activation.** The description field is the most critical piece of metadata. It controls whether the skill loads -- all other content is irrelevant if the skill never activates.
- **Activation, not explanation.** Descriptions should communicate when to trigger, not how the skill works internally.

### OpenAI
- **Use enums and structure.** Constrain inputs to valid states where possible. Make invalid activation states unrepresentable through precise description language.
- **Keep skills narrow and modular.** One skill, one capability. Broad skills trigger on unrelated queries and dilute instruction quality.

### Google/Gemini
- **Semantic routing via descriptions.** Descriptions serve as routing keys. Communicate WHEN the skill applies (trigger conditions) rather than WHAT it contains (implementation details).
- **Five patterns.** Different skill types require different description strategies. An instruction-only skill needs different trigger phrases than a complex orchestration skill.

### Unified Principle
The description is a routing mechanism, not documentation. Include specific trigger phrases users would actually say. Keep each skill focused on a single capability to avoid routing ambiguity.

---

## 4. Modularity and Skill Scope

### Anthropic
- **Start minimal.** Begin with the simplest possible skill. Add instructions only when observed failure modes justify them. Resist preemptive over-specification.
- **Dial back for newer models.** More capable models require less prescriptive instructions. Overly aggressive prompting for advanced models wastes tokens and can degrade performance by over-constraining.

### OpenAI
- **One skill, one capability.** Each skill should do one thing well. Modular skills compose better than monolithic ones.
- **Three agentic reminders.** For agentic skills, reinforce: persistence (keep working until complete), tool-calling (use available tools), planning (think before acting).

### Google/Gemini
- **Five complexity levels.** Match the skill pattern to the task complexity. Simple tasks need Instruction-Only skills; complex multi-tool workflows need Complex Orchestration skills. Mismatched complexity causes either over-engineering or under-specification.
- **Six behavioral dimensions.** Evaluate skills across reasoning, diagnosis, exhaustiveness, adaptability, persistence, and risk assessment. Not every skill needs all six -- select the dimensions relevant to the domain.

### Unified Principle
Start simple. Match skill complexity to task complexity. Keep each skill focused on one domain. For agentic workflows, explicitly encode persistence and planning expectations.

---

## 5. Examples and Few-Shot Patterns

### Anthropic
- **Concrete examples over verbose rules.** Examples communicate format, style, and constraints simultaneously. Replace lengthy rule sets with well-chosen demonstrations.
- **Use scripts for deterministic operations.** When the same code gets rewritten each invocation, bundle it as a script.

### OpenAI
- **Fewer, higher-relevance examples.** Two precisely targeted examples outperform ten loosely related ones. Each example should demonstrate a distinct aspect of the expected behavior.
- **Iterate with evals.** Test skills against evaluation datasets. Measure quality. Refine based on metrics, not intuition.

### Google/Gemini
- **Few-shot as a skill pattern.** Few-shot examples constitute a distinct authoring pattern. Use when output format, style, or structure is critical.
- **Input-output pairs.** Structure examples as clear input-output pairs. Include edge cases that demonstrate boundary handling.

### Unified Principle
Use 2-5 high-relevance examples. Structure them as input-output pairs. Each example should demonstrate a distinct behavior. Validate with real test cases.

---

## 6. Structure and Organization

### Anthropic
- **Three-tier progressive disclosure.** Metadata (always loaded), core instructions (loaded on activation), supporting files (loaded on demand). This maps to the natural hierarchy of skill content.

### OpenAI
- **System prompt sections.** Identity, Instructions, Output Format, Examples, Context. Each section has a clear role. Maintain this structure for consistency.
- **Make invalid states unrepresentable.** Use structured formats (enums, schemas, tables) to constrain the model's output space.

### Google/Gemini
- **Context-Instructions-Constraints ordering.** Place background context first, procedural instructions in the middle, and constraints/guardrails last. This ordering optimizes model processing.
- **Structured output.** Use markdown tables, code blocks, and clear headers. Structured documents are parsed more reliably than prose.

### Unified Principle
Organize skill content hierarchically: context, then instructions, then constraints. Use structured formats (tables, code blocks, headers) for scannability. Leverage progressive disclosure to manage context window efficiently.

---

## 7. Iteration and Maintenance

### Anthropic
- **Start minimal, add on failure.** Begin with the fewest instructions possible. Add only when the model demonstrably fails without them.
- **Dial back aggressive prompting.** As models improve, instructions that were once necessary may become counterproductive. Periodically audit and trim.

### OpenAI
- **Iterate with evals.** Create evaluation datasets. Test systematically. Measure before and after changes. Never rely on intuition alone.
- **Persistence reminder.** When skills involve multi-step tasks, remind the model to persist through completion rather than stopping early.

### Google/Gemini
- **Six behavioral dimensions as evaluation axes.** Assess skill quality across reasoning, diagnosis, exhaustiveness, adaptability, persistence, and risk assessment.
- **Pattern evolution.** As skills mature, they may graduate from simpler patterns (Instruction-Only) to more complex ones (Procedural Logic, Complex Orchestration).

### Unified Principle
Iteration is the core loop. Start minimal, test against real usage, add instructions only where failure is observed, and periodically remove instructions that newer models no longer need. Use structured evaluation, not intuition.
