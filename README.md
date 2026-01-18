# dotfile

Personal dotfiles for zsh and WezTerm.

## Install

```sh
./install.sh
```

## Bootstrap (new machine)

```sh
./bootstrap.sh
```

Then run:

```sh
gh auth login
./install.sh
```

## Notes

- WezTerm keybinds are managed at `wezterm/keybinds.lua` and linked to `~/.config/wezterm/keybinds.lua`.
- `~/.config/.czrc` is not committed; see `czrc/.czrc.example` for a template.
