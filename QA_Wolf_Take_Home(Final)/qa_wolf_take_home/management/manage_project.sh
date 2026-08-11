#!/usr/bin/env bash
# Cross-platform helper to show a warning modal and perform actions:
# 1) Clear logs (confirm)
# 2) Delete node_modules (confirm)
# 3) Cancel

ROOT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
BUILD_DIR="$ROOT_DIR/build"
NODE_MODULES="$ROOT_DIR/node_modules"

# Use zenity (Linux), osascript (macOS), or fallback to console

show_menu_zenity() {
  CHOICE=$(zenity --list --title="Project Maintenance" --text="Choose an action" --radiolist --column "" --column "Action" TRUE "Clear logs" FALSE "Delete node_modules" FALSE "Cancel" --height=200 --width=360) || return 1
  echo "$CHOICE"
}

show_menu_osascript() {
  BUTTON=$(osascript -e 'display dialog "Choose an action" buttons {"Cancel","Delete node_modules","Clear logs"} default button "Clear logs" with title "Project Maintenance" with icon caution' 2>/dev/null)
  # BUTTON will contain something like: button returned:Clear logs
  echo "$BUTTON" | sed -n "s/.*button returned:\(.*\)/\1/p"
}

confirm_zenity() {
  zenity --question --title="Confirm" --text="$1" && return 0 || return 1
}

confirm_osascript() {
  osascript -e "button returned of (display dialog \"$1\" buttons {\"No\",\"Yes\"} default button \"No\" with title \"Confirm\" with icon caution)" 2>/dev/null | grep -q "Yes" && return 0 || return 1
}

# Decide UI
if command -v zenity >/dev/null 2>&1; then
  UI=zenity
elif command -v osascript >/dev/null 2>&1; then
  UI=osascript
else
  UI=console
fi

case "$UI" in
  zenity)
    ACTION=$(show_menu_zenity) || exit 0
    case "$ACTION" in
      "Clear logs")
        if confirm_zenity "Are you SURE you want to CLEAR all logs?"; then
          find "$BUILD_DIR" -type f \( -name "*.log" -o -name "report.html" \) -delete 2>/dev/null || true
          zenity --info --text="Logs cleared." || true
        else
          zenity --info --text="Cancelled." || true
        fi
        ;;
      "Delete node_modules")
        if confirm_zenity "Are you SURE you want to DELETE node_modules? This cannot be undone."; then
          rm -rf "$NODE_MODULES"
          zenity --info --text="node_modules deleted." || true
        else
          zenity --info --text="Cancelled." || true
        fi
        ;;
      *)
        zenity --info --text="Cancelled." || true
        ;;
    esac
    ;;
  osascript)
    ACTION=$(show_menu_osascript)
    case "$ACTION" in
      "Clear logs")
        if confirm_osascript "Are you SURE you want to CLEAR all logs?"; then
          find "$BUILD_DIR" -type f \( -name "*.log" -o -name "report.html" \) -delete 2>/dev/null || true
          osascript -e 'display alert "Logs cleared."'
        else
          osascript -e 'display alert "Cancelled."'
        fi
        ;;
      "Delete node_modules")
        if confirm_osascript "Are you SURE you want to DELETE node_modules? This cannot be undone."; then
          rm -rf "$NODE_MODULES"
          osascript -e 'display alert "node_modules deleted."'
        else
          osascript -e 'display alert "Cancelled."'
        fi
        ;;
      *)
        osascript -e 'display alert "Cancelled."'
        ;;
    esac
    ;;
  console)
    echo "Project Maintenance"
    echo "1) Clear logs"
    echo "2) Delete node_modules"
    echo "3) Cancel"
    read -p "Choose 1, 2 or 3: " CH
    case "$CH" in
      1)
        read -p "Are you sure you want to CLEAR all logs? (y/N) " CONF
        if [[ "$CONF" =~ ^[Yy]$ ]]; then
          find "$BUILD_DIR" -type f \( -name "*.log" -o -name "report.html" \) -delete 2>/dev/null || true
          echo "Logs cleared."
        else
          echo "Cancelled."
        fi
        ;;
      2)
        read -p "Are you sure you want to DELETE node_modules? This cannot be undone. (y/N) " CONF
        if [[ "$CONF" =~ ^[Yy]$ ]]; then
          rm -rf "$NODE_MODULES"
          echo "node_modules deleted."
        else
          echo "Cancelled."
        fi
        ;;
      *)
        echo "Cancelled."
        ;;
    esac
    ;;
esac
