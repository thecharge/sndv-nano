export interface CompletionOpts {
	format: string;
}

export const COMPLETION_USAGE = `sndv completion <bash|zsh|fish>

Examples:
  sndv completion bash >> ~/.bashrc
  sndv completion zsh >> ~/.zshrc
  sndv completion fish > ~/.config/fish/completions/sndv.fish`;

export const completion = async (opts: CompletionOpts): Promise<string> => {
	if (opts.format === "bash") return bashCompletion();
	if (opts.format === "zsh") return zshCompletion();
	if (opts.format === "fish") return fishCompletion();
	return COMPLETION_USAGE;
};

const COMMANDS = [
	"init",
	"run",
	"status",
	"memory",
	"task",
	"protocol",
	"propose",
	"scaffold",
	"completion",
	"help",
	"--help",
	"-h",
	"--version",
	"-v",
];

const bashCompletion = (): string => `# sndv bash completion
_sndv_complete() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${COMMANDS.join(" ")}" -- "$cur") )
    return 0
  fi

  case "$prev" in
    task)
      COMPREPLY=( $(compgen -W "list add remove" -- "$cur") )
      return 0
      ;;
    protocol)
      COMPREPLY=( $(compgen -W "list archive restore" -- "$cur") )
      return 0
      ;;
    scaffold)
      COMPREPLY=( $(compgen -W "claude copilot opencode all" -- "$cur") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      return 0
      ;;
  esac

  case "\${COMP_WORDS[1]}" in
    init)
      COMPREPLY=( $(compgen -W "--type --name" -- "$cur") )
      ;;
    run)
      COMPREPLY=( $(compgen -W "--qmd --dry-run --no-llm" -- "$cur") )
      ;;
    memory)
      COMPREPLY=( $(compgen -W "--export --patterns --graduate" -- "$cur") )
      ;;
    task)
      COMPREPLY=( $(compgen -W "--name --risk --depends-on --description" -- "$cur") )
      ;;
    protocol)
      COMPREPLY=( $(compgen -W "--name" -- "$cur") )
      ;;
    propose)
      COMPREPLY=( $(compgen -W "--goal --goal-file --append --type" -- "$cur") )
      ;;
    scaffold)
      COMPREPLY=( $(compgen -W "--force" -- "$cur") )
      ;;
  esac
}
complete -F _sndv_complete sndv
`;

const zshCompletion = (): string => `#compdef sndv

_arguments -C \
  '1:command:->cmds' \
  '*::arg:->args'

case $state in
  cmds)
    _values 'command' ${COMMANDS.join(" ")}
    ;;
  args)
    case $words[2] in
      task)
        _values 'task action' list add remove
        ;;
      protocol)
        _values 'protocol action' list archive restore
        ;;
      scaffold)
        _values 'scaffold target' claude copilot opencode all
        ;;
      completion)
        _values 'completion' bash zsh fish
        ;;
    esac
    ;;
 esac
`;

const fishCompletion = (): string => `# sndv fish completion
complete -c sndv -f -n '__fish_use_subcommand' -a '${COMMANDS.join(" ")}'

complete -c sndv -n '__fish_seen_subcommand_from task' -a 'list add remove'
complete -c sndv -n '__fish_seen_subcommand_from protocol' -a 'list archive restore'
complete -c sndv -n '__fish_seen_subcommand_from scaffold' -a 'claude copilot opencode all'
complete -c sndv -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'

complete -c sndv -n '__fish_seen_subcommand_from init' -l type -l name
complete -c sndv -n '__fish_seen_subcommand_from run' -l qmd -l dry-run -l no-llm
complete -c sndv -n '__fish_seen_subcommand_from memory' -l export -l patterns -l graduate
complete -c sndv -n '__fish_seen_subcommand_from task' -l name -l risk -l depends-on -l description
complete -c sndv -n '__fish_seen_subcommand_from protocol' -l name
complete -c sndv -n '__fish_seen_subcommand_from propose' -l goal -l goal-file -l append -l type
complete -c sndv -n '__fish_seen_subcommand_from scaffold' -l force
`;
