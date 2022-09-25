set rtp +=~/.config/nvim
set nohidden

call plug#begin('~/.config/nvim/plugged')
Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'
Plug 'simnalamburt/vim-mundo'
call plug#end()

syntax on


let mapleader="<space>"
map <Space> <Leader>
nnoremap <leader>bn :bnext<cr> ;buffer next
nnoremap <leader>tn gt ;next tab

set undofile
set undodir=~/.configure/nvim/private-undo-history
set undolevels=10000
