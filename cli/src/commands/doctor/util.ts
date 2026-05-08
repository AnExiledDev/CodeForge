export const SLOW_FS_TYPES = [
	"smb",
	"smb2",
	"9p",
	"drvfs",
	"cifs",
	"nfs",
	"fuse.drvfs",
];

export async function spawn(
	cmd: string,
	args: string[],
): Promise<{ stdout: string; exitCode: number }> {
	try {
		const proc = Bun.spawn([cmd, ...args], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const stdout = await new Response(proc.stdout).text();
		const exitCode = await proc.exited;
		return { stdout: stdout.trim(), exitCode };
	} catch {
		return { stdout: "", exitCode: 1 };
	}
}
