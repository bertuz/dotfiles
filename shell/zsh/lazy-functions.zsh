# aliases
function lazy_jenv {
  unset -f jenv
  unset -f java

  export PATH="$HOME/.jenv/bin:$PATH"
  eval "$(jenv init -)"
}

# aliases
function jenv { lazy_jenv; jenv "$@"; }
function java { lazy_jenv; java "$@"; }

function lazy_nvm {
  unset -f nvm
  unset -f npm
  unset -f node
  unset -f npx
  unset -f yarn
  unset -f gradle
  unset -f mvn

  if [ -d "${HOME}/.nvm" ]; then
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" # linux
    [ -s "$(brew --prefix nvm)/nvm.sh" ] && source $(brew --prefix nvm)/nvm.sh # osx
  fi
}

# aliases
function nvm { lazy_nvm; nvm "$@"; }
function npm { lazy_nvm; npm "$@"; }
function node { lazy_nvm; node "$@"; }
function npx { lazy_nvm; npx "$@"; }
function yarn { lazy_nvm; yarn "$@"; }
function gradle { lazy_nvm; gradle "$@"; }
function mvn { lazy_nvm; mvn "$@"; }
