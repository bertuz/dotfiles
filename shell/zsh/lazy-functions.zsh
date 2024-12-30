# aliases
#jenv_cmds=("jenv" "java" "gradle" "mvn")
#
#function lazy_jenv {
#  local value
#  for value in ${jenv_cmds[@]}; do
#    unset -f ${value}
#  done
#
#  export PATH="$HOME/.jenv/bin:$PATH"
#  eval "$(jenv init -)"
#}
#
#for value in ${jenv_cmds[@]}; do
#  function ${value} {
#    lazy_jenv; ${0} "$@";
#  }
#done
#
#unset value;
export SDKMAN_DIR=$(brew --prefix sdkman-cli)/libexec
[[ -s "${SDKMAN_DIR}/bin/sdkman-init.sh" ]] && source "${SDKMAN_DIR}/bin/sdkman-init.sh"

nvm_cmds=("nvm" "npm" "node" "npx" "yarn")
function lazy_nvm {
  local value;
  for value in ${nvm_cmds[@]}; do
    unset -f ${value};
  done

  if [ -d "${HOME}/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # linux
    [ -s "$(brew --prefix nvm)/nvm.sh" ] && source $(brew --prefix nvm)/nvm.sh # osx
  fi
}

# aliases
for value in ${nvm_cmds[@]}; do
  function ${value} { lazy_nvm; ${0} "$@"; }
done