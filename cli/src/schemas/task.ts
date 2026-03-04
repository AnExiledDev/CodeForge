export interface Task {
	id: string;
	subject: string;
	description: string;
	activeForm?: string;
	status: string;
	blocks: string[];
	blockedBy: string[];
}
