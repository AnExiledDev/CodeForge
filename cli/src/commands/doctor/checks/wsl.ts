import type { CheckResult } from "../types.js";

async function getHostRamGB(): Promise<number> {
	try {
		const content = await Bun.file("/proc/meminfo").text();
		const match = content.match(/MemTotal:\s+(\d+)\s+kB/);
		if (!match) return 0;
		return Math.round(Number(match[1]) / 1024 / 1024);
	} catch {
		return 0;
	}
}

interface WslConfigTier {
	memory: string;
	swap: string;
}

function getWslConfigTier(ramGB: number): WslConfigTier {
	if (ramGB <= 16) return { memory: "8GB", swap: "1GB" };
	if (ramGB <= 32) return { memory: "12GB", swap: "2GB" };
	if (ramGB <= 64) return { memory: "16GB", swap: "2GB" };
	return { memory: "24GB", swap: "2GB" };
}

function generateWslConfig(tier: WslConfigTier): string {
	return [
		"[wsl2]",
		`memory=${tier.memory}`,
		`swap=${tier.swap}`,
		"autoMemoryReclaim=gradual",
		"sparseVhd=true",
		"",
	].join("\n");
}

export async function checkWslConfig(
	isWsl: boolean,
): Promise<CheckResult | null> {
	if (!isWsl) return null;

	const totalRamGB = await getHostRamGB();
	if (totalRamGB === 0) {
		return {
			name: "WSL memory configuration",
			category: "wsl",
			status: "info",
			message: "could not detect host RAM",
			hint: "Check /proc/meminfo is readable",
		};
	}

	const tier = getWslConfigTier(totalRamGB);
	const config = generateWslConfig(tier);

	return {
		name: "WSL memory configuration",
		category: "wsl",
		status: "info",
		message: `${totalRamGB}GB host RAM detected`,
		hint: "Optimize WSL with a .wslconfig file",
		fix: {
			label: "Generate optimized .wslconfig",
			detail: `A .wslconfig file controls WSL2 resource allocation. Based on ${totalRamGB}GB host RAM, the recommended settings limit WSL to ${tier.memory} memory and ${tier.swap} swap, enable gradual memory reclaim to return unused pages to the host, and enable sparse VHD to reclaim disk space automatically.`,
			impact: "advisory only — must save manually on Windows host",
			requiresRebuild: false,
			apply: async () => ({
				applied: false,
				message:
					"Cannot auto-apply from inside the container. Save the .wslconfig content shown below to your Windows host, then restart WSL with: wsl --shutdown",
				advisory: `Save this to %USERPROFILE%\\.wslconfig on your Windows host:\n\n${config}\nThen restart WSL:\n  wsl --shutdown`,
			}),
		},
	};
}

export async function checkDefenderExclusions(
	isWsl: boolean,
): Promise<CheckResult | null> {
	if (!isWsl) return null;

	const powershellCommands = [
		"# Run as Administrator in PowerShell",
		'Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\\Docker"',
		'Add-MpPreference -ExclusionPath "$env:PROGRAMFILES\\Docker"',
		'Add-MpPreference -ExclusionProcess "com.docker.backend.exe"',
		'Add-MpPreference -ExclusionProcess "vpnkit.exe"',
		'Add-MpPreference -ExclusionProcess "wsl.exe"',
		'Add-MpPreference -ExclusionProcess "wslhost.exe"',
		"# Add your project path:",
		'# Add-MpPreference -ExclusionPath "\\\\wsl$\\Ubuntu\\home\\<user>\\projects"',
	].join("\n");

	return {
		name: "Windows Defender exclusions",
		category: "wsl",
		status: "info",
		message: "Defender real-time scanning may slow file operations",
		hint: "Exclude WSL and project paths from Defender",
		fix: {
			label: "Generate Defender exclusion commands",
			detail:
				"Windows Defender real-time protection scans every file operation that crosses the WSL/Windows boundary. Excluding Docker and WSL processes from scanning can significantly reduce I/O latency for builds, installs, and file watches.",
			impact: "advisory only — requires admin PowerShell on Windows host",
			requiresRebuild: false,
			apply: async () => ({
				applied: false,
				message:
					"Cannot auto-apply from inside the container. Run the PowerShell commands shown below as Administrator on your Windows host.",
				advisory: `Run these commands in an elevated PowerShell session on your Windows host:\n\n${powershellCommands}`,
			}),
		},
	};
}
