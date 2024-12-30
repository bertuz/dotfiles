function cdd() {
  cd "$(ls -d -- */ | fzf)" || echo "Invalid directory"
}

function j() {
  fname=$(declare -f -F _z)

  [ -n "$fname" ] || source "$DOTLY_PATH/modules/z/z.sh"

  _z "$1"
}

function recent_dirs() {
  # This script depends on pushd. It works better with autopush enabled in ZSH
  escaped_home=$(echo $HOME | sed 's/\//\\\//g')
  selected=$(dirs -p | sort -u | fzf)

  cd "$(echo "$selected" | sed "s/\~/$escaped_home/")" || echo "Invalid directory"
}

cd() {
    builtin cd "$@"
    ls
    echo "\n"
}

function cdc () {
  builtin cd "${HOME}/Code/${1}"

  if [[ $2 != "" ]] ; then
    builtin cd "${2}"
  fi
}

function o2de-pages () {
  pushd ./ && cd $(grep -Ril --extended-regexp "O2De.+Agent" ./web/src/pages | sed -E "s/\.\/web\/src\/pages\/([^\/]+)\/.+\.ts[x]{0,1}/\1/g" | sed '$!N; /^\(.*\)\n\1$/!P; D' | sed 's/^/web\/src\/pages\//; s/$//' | fzf )
}