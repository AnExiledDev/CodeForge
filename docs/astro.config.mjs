import sitemap from "@astrojs/sitemap";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import astroMermaid from "astro-mermaid";
import starlightImageZoom from "starlight-image-zoom";
import starlightKbd from "starlight-kbd";
import starlightLinksValidator from "starlight-links-validator";
import starlightLlmsTxt from "starlight-llms-txt";
import starlightScrollToTop from "starlight-scroll-to-top";
import starlightSidebarTopics from "starlight-sidebar-topics";
// Uncomment when activating versioned docs (see plugin comment below)
// import starlightVersions from "starlight-versions";

export default defineConfig({
	site: "https://codeforge.core-directive.com",
	integrations: [
		// astro-mermaid MUST be registered BEFORE starlight
		astroMermaid(),
		starlight({
			title: "CodeForge",
			tagline: "Your AI dev environment, battle-tested.",
			logo: {
				src: "./src/assets/logo.png",
				replacesTitle: false,
			},
			social: [
				{
					icon: "github",
					label: "GitHub",
					href: "https://github.com/AnExiledDev/CodeForge",
				},
				{ icon: "x.com", label: "X", href: "https://x.com/AnExiledDev" },
			],
			customCss: ["./src/styles/global.css"],
			components: {
				Hero: "./src/components/Hero.astro",
				Header: "./src/components/Header.astro",
			},
			editLink: {
				baseUrl: "https://github.com/AnExiledDev/CodeForge/edit/main/docs/",
			},
			head: [
				{
					tag: "meta",
					attrs: {
						name: "og:image",
						content: "/og-image.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/png",
						href: "/favicon.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "apple-touch-icon",
						href: "/apple-touch-icon.png",
					},
				},
				{
					// Default to dark theme when no user preference is saved
					tag: "script",
					attrs: { is: "inline" },
					content: `(function(){var k='starlight-theme';if(!localStorage.getItem(k)){localStorage.setItem(k,'dark');document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark'}})()`,
				},
			],
			plugins: [
				// ── Versioned docs (activate when archiving the first version) ──
				// starlightVersions requires at least one archived version.
				// When v3 development begins, uncomment and add v2 as the first entry:
				//
				//   starlightVersions({
				//     versions: [{ slug: "2.0", label: "v2.0" }],
				//     current: { label: "v3" },
				//   }),
				//
				// Then run `npm run dev` — the plugin archives current docs as v2.0.
				// See: https://github.com/HiDeoo/starlight-versions
				starlightSidebarTopics([
					{
						label: "Start Here",
						link: "/start-here/",
						icon: "rocket",
						items: [
							{ label: "Overview", slug: "start-here" },
							{
								label: "Before You Install",
								slug: "start-here/before-you-install",
							},
							{
								label: "Install in VS Code",
								slug: "start-here/install-in-vscode",
							},
							{
								label: "Verify Your Install",
								slug: "start-here/verify-install",
							},
							{
								label: "Start Your First Session",
								slug: "start-here/first-session",
							},
							{
								label: "Your First Tasks",
								slug: "start-here/your-first-tasks",
							},
							{
								label: "DevContainer CLI",
								slug: "start-here/devcontainer-cli",
							},
							{ label: "Other Clients", slug: "start-here/other-clients" },
							{
								label: "Migrate to v2",
								slug: "start-here/migrate-to-v2",
							},
						],
					},
					{
						label: "Use CodeForge",
						link: "/use/",
						icon: "star",
						items: [
							{ label: "Overview", slug: "use" },
							{ label: "Session Basics", slug: "use/session-basics" },
							{ label: "Everyday Commands", slug: "use/everyday-commands" },
							{ label: "Agents and Skills", slug: "use/agents-and-skills" },
							{ label: "Code Intelligence", slug: "use/code-intelligence" },
							{ label: "Spec Workflow", slug: "use/spec-workflow" },
							{ label: "Ticket Workflow", slug: "use/ticket-workflow" },
							{ label: "Git and PRs", slug: "use/git-and-prs" },
							{ label: "Memories", slug: "use/memories" },
							{ label: "Accessing Services", slug: "use/accessing-services" },
						],
					},
					{
						label: "Customize",
						link: "/customize/",
						icon: "setting",
						items: [
							{ label: "Overview", slug: "customize" },
							{
								label: "Settings and Permissions",
								slug: "customize/settings-and-permissions",
							},
							{
								label: "Container Configuration",
								slug: "customize/container-configuration",
							},
							{ label: "Secrets and Auth", slug: "customize/secrets-and-auth" },
							{ label: "System Prompts", slug: "customize/system-prompts" },
							{ label: "Rules", slug: "customize/rules" },
							{ label: "Hooks", slug: "customize/hooks" },
							{
								label: "Keybindings and Terminal",
								slug: "customize/keybindings-and-terminal",
							},
							{
								label: "Optional Components",
								slug: "customize/optional-components",
							},
						],
					},
					{
						label: "Extend CodeForge",
						link: "/extend/",
						icon: "puzzle",
						items: [
							{ label: "Overview", slug: "extend" },
							{ label: "Plugin System", slug: "extend/plugin-system" },
							{ label: "Plugins Overview", slug: "extend/plugins" },
							{
								label: "Core Plugins",
								items: [
									{
										label: "Agent System",
										slug: "extend/plugins/agent-system",
									},
									{
										label: "Skill Engine",
										slug: "extend/plugins/skill-engine",
									},
									{
										label: "Spec Workflow",
										slug: "extend/plugins/spec-workflow",
									},
									{
										label: "Ticket Workflow",
										slug: "extend/plugins/ticket-workflow",
									},
								],
							},
							{
								label: "Quality & Safety",
								items: [
									{
										label: "Auto Code Quality",
										slug: "extend/plugins/auto-code-quality",
									},
									{
										label: "Dangerous Command Blocker",
										slug: "extend/plugins/dangerous-command-blocker",
									},
									{
										label: "Workspace Scope Guard",
										slug: "extend/plugins/workspace-scope-guard",
									},
									{
										label: "Protected Files Guard",
										slug: "extend/plugins/protected-files-guard",
									},
								],
							},
							{
								label: "Session & Integration",
								items: [
									{
										label: "Session Context",
										slug: "extend/plugins/session-context",
									},
									{
										label: "Git Workflow",
										slug: "extend/plugins/git-workflow",
									},
									{
										label: "Prompt Snippets",
										slug: "extend/plugins/prompt-snippets",
									},
									{ label: "Notify Hook", slug: "extend/plugins/notify-hook" },
									{
										label: "CodeForge LSP",
										slug: "extend/plugins/codeforge-lsp",
									},
									{
										label: "Frontend Design",
										slug: "extend/plugins/frontend-design",
									},
								],
							},
						],
					},
					{
						label: "Reference",
						link: "/reference/",
						icon: "open-book",
						items: [
							{ label: "Reference Overview", slug: "reference" },
							{ label: "What’s Included", slug: "reference/whats-included" },
							{ label: "Commands", slug: "reference/commands" },
							{ label: "CLI Tools", slug: "reference/cli-tools" },
							{ label: "Agents", slug: "reference/agents" },
							{ label: "Skills", slug: "reference/skills" },
							{
								label: "Environment Variables",
								slug: "reference/environment-variables",
							},
							{ label: "Architecture", slug: "reference/architecture" },
							{ label: "Troubleshooting", slug: "reference/troubleshooting" },
							{ label: "Changelog", slug: "reference/changelog" },
						],
					},
				]),
				starlightImageZoom(),
				starlightLinksValidator({
					errorOnRelativeLinks: false,
				}),
				starlightKbd({
					types: [
						{ id: "mac", label: "macOS", detector: "apple", default: false },
						{
							id: "windows",
							label: "Windows / Linux",
							detector: "windows",
							default: true,
						},
					],
				}),
				starlightScrollToTop(),
				starlightLlmsTxt(),
			],
		}),
		sitemap(),
	],
	server: {
		host: "0.0.0.0",
	},
	vite: {
		plugins: [tailwindcss()],
	},
});
