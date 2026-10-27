#!/bin/zsh
# Double-click on macOS, or run ./start.command from this project.
cd "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  runtime="$(command -v node)"
elif [[ -x /tmp/node-v22.14.0-darwin-arm64/bin/node ]]; then
  runtime=/tmp/node-v22.14.0-darwin-arm64/bin/node
else
  print 'Install Node.js 22 LTS from https://nodejs.org, then run npm install and npm run dev.'
  read '?Press Enter to close.'
  exit 1
fi
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  print 'Dependencies are missing. Run npm install in this folder first.'
  read '?Press Enter to close.'
  exit 1
fi
BROWSER="Google Chrome" "$runtime" node_modules/vite/bin/vite.js --host 127.0.0.1 --open
