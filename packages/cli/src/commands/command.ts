export interface Command {
	execute(): Promise<string>;
}
