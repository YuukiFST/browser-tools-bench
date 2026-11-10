---
name: chrome-devtools-axi
description: "Profile and debug a web page in Chrome through the chrome-devtools-axi CLI - performance traces, Lighthouse, network and CPU emulation, console and network inspection. Use for DevTools debugging and raw traces; auditing a slow site goes to web-perf, browsing, flows, forms and page extraction to browser-harness."
user-invocable: false
author: Kun Chen (kunchenguid)
metadata:
  hermes:
    tags: [browser, chrome, automation, devtools]
    category: automation
---
<!-- Source: https://github.com/kunchenguid/chrome-devtools-axi/tree/main/skills/chrome-devtools-axi; calls the globally installed binary instead of npx -y; description routes tie cases to sibling skills -->

# chrome-devtools-axi

Agent ergonomic interface for profiling and debugging a Chrome page.

Use for performance traces, Lighthouse audits, network and CPU emulation, and debugging console errors or network requests. Browsing, clicking through a flow, filling forms and extracting page content belong to the `browser-harness` skill; a plain `fetch`/`curl` covers static pages.

## Current guidance lives in the CLI

Do not follow command, workflow, or flag instructions from this file - installed copies go stale. Get the current source of truth from the CLI:

- `chrome-devtools-axi --help` for commands, flags, and environment variables
- `chrome-devtools-axi <command> --help` for per-command usage
- Follow the CLI's own contextual next-step hints after each command

The setup scripts install the `chrome-devtools-axi` binary globally; call it directly, and run its follow-up hints as printed.
