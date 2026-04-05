import {
	CLI_COMMANDS,
	CLI_COMPLETION_FORMATS,
	CLI_PROTOCOL_ACTIONS,
	CLI_SCAFFOLD_TARGETS,
	CLI_TASK_ACTIONS,
} from "../constants";

export const buildBashCompletion = (): string => `# sndv bash completion
_sndv_complete() {
  local cur prev
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "${CLI_COMMANDS.join(" ")}" -- "$cur") )
    return 0
  fi

  case "$prev" in
    task)
      COMPREPLY=( $(compgen -W "${CLI_TASK_ACTIONS.join(" ")}" -- "$cur") )
      return 0
      ;;
    protocol)
      COMPREPLY=( $(compgen -W "${CLI_PROTOCOL_ACTIONS.join(" ")}" -- "$cur") )
      return 0
      ;;
    scaffold)
      COMPREPLY=( $(compgen -W "${CLI_SCAFFOLD_TARGETS.join(" ")}" -- "$cur") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "${CLI_COMPLETION_FORMATS.join(" ")}" -- "$cur") )
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
    link)
      COMPREPLY=( $(compgen -W "--path" -- "$cur") )
      ;;
  esac
}
complete -F _sndv_complete sndv
`;

export const buildZshCompletion = (): string => `#compdef sndv

_arguments -C \
  '1:command:->cmds' \
  '*::arg:->args'

case $state in
  cmds)
    _values 'command' ${CLI_COMMANDS.join(" ")}
    ;;
  args)
    case $words[2] in
      task)
        _values 'task action' ${CLI_TASK_ACTIONS.join(" ")}
        ;;
      protocol)
        _values 'protocol action' ${CLI_PROTOCOL_ACTIONS.join(" ")}
        ;;
      scaffold)
        _values 'scaffold target' ${CLI_SCAFFOLD_TARGETS.join(" ")}
        ;;
      completion)
        _values 'completion' ${CLI_COMPLETION_FORMATS.join(" ")}
        ;;
    esac
    ;;
 esac
`;

export const buildFishCompletion = (): string => `# sndv fish completion
complete -c sndv -f -n '__fish_use_subcommand' -a '${CLI_COMMANDS.join(" ")}'

complete -c sndv -n '__fish_seen_subcommand_from task' -a '${CLI_TASK_ACTIONS.join(" ")}'
complete -c sndv -n '__fish_seen_subcommand_from protocol' -a '${CLI_PROTOCOL_ACTIONS.join(" ")}'
complete -c sndv -n '__fish_seen_subcommand_from scaffold' -a '${CLI_SCAFFOLD_TARGETS.join(" ")}'
complete -c sndv -n '__fish_seen_subcommand_from completion' -a '${CLI_COMPLETION_FORMATS.join(" ")}'

complete -c sndv -n '__fish_seen_subcommand_from init' -l type -l name
complete -c sndv -n '__fish_seen_subcommand_from run' -l qmd -l dry-run -l no-llm
complete -c sndv -n '__fish_seen_subcommand_from memory' -l export -l patterns -l graduate
complete -c sndv -n '__fish_seen_subcommand_from task' -l name -l risk -l depends-on -l description
complete -c sndv -n '__fish_seen_subcommand_from protocol' -l name
complete -c sndv -n '__fish_seen_subcommand_from propose' -l goal -l goal-file -l append -l type
complete -c sndv -n '__fish_seen_subcommand_from scaffold' -l force
complete -c sndv -n '__fish_seen_subcommand_from link' -l path
`;
