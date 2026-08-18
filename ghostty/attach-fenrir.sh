#!/bin/sh
# Ghostty の起動コマンド (config の `command =` から呼ばれる)。
# fenrir へ ssh し herdr の永続 session に attach。detach 後は fenrir の login zsh。
exec ssh fenrir -t 'herdr; exec zsh -l'
