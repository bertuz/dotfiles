# vim:et sts=2 sw=2 ft=zsh
#
# Oblong theme
#
# Requires the `git-info` zmodule to be included in the .zimrc file.

_prompt_basher_pwd() {
  local git_root current_dir dir repo_name
  if git_root=$(git rev-parse --show-cdup 2>/dev/null || false); then
    dir=$(builtin cd "./${git_root}" && pwd)
    repo_name=$(basename "$(git rev-parse --show-toplevel)")
    current_dir="${repo_name} ${$(pwd)#${dir}}/"
  else
    current_dir=${(%):-%~}
  fi
  print -n "%F{blue}${current_dir}%b"
}

VIRTUAL_ENV_DISABLE_PROMPT=1

setopt nopromptbang prompt{cr,percent,sp,subst}

typeset -gA git_info
if (( ${+functions[git-info]} )); then
  zstyle ':zim:git-info:branch' format '%b'
  zstyle ':zim:git-info:commit' format '%c'
  zstyle ':zim:git-info:clean' format '%F{green} ◍'
  zstyle ':zim:git-info:dirty' format '%F{red} ◍'
  zstyle ':zim:git-info:keys' format \
      'prompt' ' %F{white}%b%c%C%D'

  autoload -Uz add-zsh-hook && add-zsh-hook precmd git-info
fi

PS1='%(?:%F{white}:%F{red})◼ ${VIRTUAL_ENV:+"(${VIRTUAL_ENV:t}) "}%(!:%F{red}:%F{white})$(_prompt_basher_pwd)${(e)git_info[prompt]} %f%(!:#:$) '

RPS1='%(?::%F{red}$?) %(!.#.)'

