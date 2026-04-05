import {
	CLI_COMMANDS,
	CLI_COMPLETION_FORMATS,
	CLI_DEFAULT_SYMLINK_PATH,
	CLI_PROTOCOL_ACTIONS,
	CLI_SCAFFOLD_TARGETS,
	CLI_TASK_ACTIONS,
	DEFAULT_LLM_BASE_URL,
	DEFAULT_LLM_MODEL,
} from "../constants";

export const buildCliUsage = (version: string): string => `sndv — SMEP CLI (v${version})

Usage:
  sndv init [--type greenfield|brownfield] [--name project-name]
  sndv run [--qmd path] [--dry-run] [--no-llm]
  sndv status
  sndv memory [--export id] [--patterns] [--graduate]
  sndv task <${CLI_TASK_ACTIONS.join("|")}> [--name n] [--risk 0.9] [--depends-on a,b]
  sndv protocol <${CLI_PROTOCOL_ACTIONS.join("|")}> [--name n]
  sndv propose --goal <text> | --goal-file <path> [--append] [--type greenfield|brownfield]
  sndv scaffold <${CLI_SCAFFOLD_TARGETS.join("|")}> [--force]
  sndv completion <${CLI_COMPLETION_FORMATS.join("|")}>
  sndv link [--path <path>]
  sndv --version

Commands:
  init       Create a new SMEP project in the current directory
  run        Execute protocol — with LLM by default, --no-llm for offline
  status     Show project status and memory summary
  memory     Inspect and manage memory (export, patterns, graduate)
  task       Add, remove, or list tasks in the protocol
  protocol   Archive, restore, or list protocols
  propose    Ask the LLM to decompose a goal into falsification tasks
  scaffold   Generate agent instruction files (CLAUDE.md, copilot, AGENTS.md)
  completion Install shell autocompletion
  link       Create a local symlink at ${CLI_DEFAULT_SYMLINK_PATH}

Environment (vendor-agnostic):
  SNDV_LLM_API_KEY    API key for any OpenAI-compatible endpoint
  SNDV_LLM_BASE_URL   Base URL (default: ${DEFAULT_LLM_BASE_URL})
  SNDV_LLM_MODEL      Model name (default: "${DEFAULT_LLM_MODEL}")

All commands: ${CLI_COMMANDS.join(", ")}`;

export const buildTaskUsage = (): string => `sndv task <action> [options]

Actions:
  list                      List all tasks in the protocol
  add --name <n> [options]  Add a task to the protocol
  remove --name <n>         Remove a task from the protocol

Options (for add):
  --name <name>             Task name (required)
  --risk <0.0-1.0>          Risk score (default: 0.5)
  --depends-on <a,b>        Comma-separated dependency names
  --description <text>      What to try to break`;

export const buildProposeUsage = (): string => `sndv propose --goal <text> [options]
sndv propose --goal-file <path> [options]

Options:
  --goal <text>         Goal as inline text
  --goal-file <path>    Read goal from a file (supports large/multiline goals)
  --append              Append tasks to existing protocol instead of creating new
  --type <greenfield|brownfield>  Protocol type (default: greenfield)`;

export const buildMemoryUsage = (): string =>
	"Usage: sndv memory [--export <id>] [--patterns] [--graduate]";

export const buildProtocolUsage = (): string => `sndv protocol <action> [options]

Actions:
  list                   List current and archived protocols
  archive [--name <n>]   Archive the current protocol (optional name)
  restore --name <n>     Restore an archived protocol as current`;

export const buildScaffoldUsage = (): string => `sndv scaffold <target>

Targets:
  claude     Generate CLAUDE.md for Claude Code
  copilot    Generate .github/copilot-instructions.md for GitHub Copilot
  opencode   Generate AGENTS.md for opencode
  all        Generate instruction files for all agents

Options:
  --force    Overwrite existing files`;

export const buildLinkUsage = (): string => `sndv link [--path <path>]

Creates a user-level symlink at ${CLI_DEFAULT_SYMLINK_PATH} (default).`;

export const buildLinkSuccess = (linkPath: string, targetPath: string): string =>
	`Linked ${linkPath} -> ${targetPath}`;

export const buildLinkAlreadyLinked = (linkPath: string): string =>
	`Link already exists: ${linkPath}`;

export const buildLinkConflict = (linkPath: string): string =>
	`Path exists and is not a symlink: ${linkPath}`;

export const buildCompletionUsage =
	(): string => `sndv completion <${CLI_COMPLETION_FORMATS.join("|")}>

Examples:
  sndv completion bash >> ~/.bashrc
  sndv completion zsh >> ~/.zshrc
  sndv completion fish > ~/.config/fish/completions/sndv.fish`;
