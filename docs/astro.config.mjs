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

export default defineConfig({
	site: "https://anexileddev.github.io",
	base: "/CodeForge",
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
						content: "/CodeForge/og-image.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "icon",
						type: "image/png",
						href: "/CodeForge/favicon.png",
					},
				},
				{
					tag: "link",
					attrs: {
						rel: "apple-touch-icon",
						href: "/CodeForge/apple-touch-icon.png",
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
				starlightSidebarTopics(
					[
						{
							label: 'Getting Started',
							link: '/getting-started/',
							icon: 'rocket',
							items: [
								{ label: 'Overview', slug: 'getting-started' },
								{ label: 'Requirements', slug: 'getting-started/requirements' },
								{ label: 'Installation', slug: 'getting-started/installation' },
								{ label: 'Your First Session', slug: 'getting-started/first-session' },
							],
						},
						{
							label: 'Plugins',
							link: '/plugins/',
							icon: 'puzzle',
							items: [
								{ label: 'Plugin Overview', slug: 'plugins' },
								{
									label: 'Core Plugins',
									items: [
										{ label: 'Agent System', slug: 'plugins/agent-system' },
										{ label: 'Skill Engine', slug: 'plugins/skill-engine' },
										{ label: 'Spec Workflow', slug: 'plugins/spec-workflow' },
										{ label: 'Ticket Workflow', slug: 'plugins/ticket-workflow' },
									],
								},
								{
									label: 'Quality & Safety',
									items: [
										{ label: 'Auto Code Quality', slug: 'plugins/auto-code-quality' },
										{ label: 'Dangerous Command Blocker', slug: 'plugins/dangerous-command-blocker' },
										{ label: 'Workspace Scope Guard', slug: 'plugins/workspace-scope-guard' },
										{ label: 'Protected Files Guard', slug: 'plugins/protected-files-guard' },
									],
								},
								{
									label: 'Session & Integration',
									items: [
										{ label: 'Session Context', slug: 'plugins/session-context' },
										{ label: 'Git Workflow', slug: 'plugins/git-workflow' },
										{ label: 'Prompt Snippets', slug: 'plugins/prompt-snippets' },
										{ label: 'Notify Hook', slug: 'plugins/notify-hook' },
										{ label: 'CodeForge LSP', slug: 'plugins/codeforge-lsp' },
										{ label: 'Frontend Design', slug: 'plugins/frontend-design' },
									],
								},
							],
						},
						{
							label: 'Features',
							link: '/features/',
							icon: 'star',
							items: [
								{ label: 'Features Overview', slug: 'features' },
								{ label: 'AI Agents', slug: 'features/agents' },
								{ label: 'Skills', slug: 'features/skills' },
								{ label: 'CLI Tools', slug: 'features/tools' },
								{ label: 'Code Intelligence', slug: 'features/code-intelligence' },
							],
						},
						{
							label: 'Customization',
							link: '/customization/',
							icon: 'setting',
							items: [
								{ label: 'Customization Overview', slug: 'customization' },
								{ label: 'Configuration', slug: 'customization/configuration' },
								{ label: 'System Prompts', slug: 'customization/system-prompts' },
								{ label: 'Rules', slug: 'customization/rules' },
								{ label: 'Hooks', slug: 'customization/hooks' },
								{ label: 'Keybindings', slug: 'customization/keybindings' },
								{ label: 'Optional Features', slug: 'customization/optional-features' },
							],
						},
						{
							label: 'Reference',
							link: '/reference/',
							icon: 'open-book',
							items: [
								{ label: 'Reference Overview', slug: 'reference' },
								{ label: 'Changelog', slug: 'reference/changelog' },
								{ label: 'Commands', slug: 'reference/commands' },
								{ label: 'Environment Variables', slug: 'reference/environment' },
								{ label: 'Architecture', slug: 'reference/architecture' },
								{ label: 'Port Forwarding', slug: 'reference/port-forwarding' },
								{ label: 'Troubleshooting', slug: 'reference/troubleshooting' },
							],
						},
					],
				),
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
