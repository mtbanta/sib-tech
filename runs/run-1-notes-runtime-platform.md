# Run 1 notes: runtime and platform limits

Date of research: 2026-10-08 (America/Chicago), confirmed with `date`.

Purpose: a findings register on the hard limits of each place a personal intraday trading agent could run. This file is research input for a human decision. It is not a verdict and not an instruction to act.

**How quotes were captured.** Pages were fetched live in this session with a fetch tool that converts the page to text and passes it through a small summarizing model. Every fetch asked for exact sentences, but a quote can still come back lightly paraphrased. Treat each quote as a pointer to the page, and re-open the URL before relying on exact wording. Any em dash or en dash in a source quote has been replaced with a hyphen.

**Labels.** Strength: A = vendor's own documentation, pricing page or terms, seen live. B = reputable independent press or established reference publisher. C = review, comparison or affiliate sites. D = forums, social posts, personal blogs, community code repositories. Price: "published" (vendor's own public page, seen live), "corroborated" (two or more independent sources agree, named), "gated and unverified".

All access dates are 2026-10-08 unless a finding says otherwise.

## 1. Findings register

### Part 1: Claude as the driver

**RT-01.** Claude Code used on a Free, Pro or Max plan falls under Anthropic's Consumer Terms of Service. Team, Enterprise and API use falls under the Commercial Terms.
- Page: "Legal and compliance" (Claude Code docs). URL: https://code.claude.com/docs/en/legal-and-compliance.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Commercial Terms of Service - for Team, Enterprise, and Claude API users. Consumer Terms of Service - for Free, Pro, and Max users"

**RT-02.** Anthropic says the advertised Pro and Max usage limits assume ordinary, individual use, and it names both Claude Code and the Agent SDK in that sentence. The page does not define "ordinary".
- Page: "Legal and compliance", section "Acceptable use". URL: https://code.claude.com/docs/en/legal-and-compliance.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK."

**RT-03.** Subscription sign-in (OAuth, the browser login) is meant for ordinary use of Claude Code and Anthropic's own apps. Developers building products or services on Claude, including with the Agent SDK, are told to use API keys (pay as you go). The explicit prohibition is aimed at third parties routing other people's requests through subscription credentials. The page does not say in so many words whether an individual may run a personal unattended agent on their own subscription; it points to sales for "permitted authentication methods for your use case".
- Page: "Legal and compliance", section "Authentication and credential use". URL: https://code.claude.com/docs/en/legal-and-compliance.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "OAuth authentication is intended exclusively for purchasers of Claude Free, Pro, Max, Team, and Enterprise subscription plans and is designed to support ordinary use of Claude Code and other native Anthropic applications."
- Second quote: "Developers building products or services that interact with Claude's capabilities, including those using the Agent SDK, should use API key authentication through Claude Console or a supported cloud provider."

**RT-04.** The Agent SDK overview repeats the rule against offering claude.ai login in third-party products, tells builders to use API key authentication, and says SDK use is governed by the Commercial Terms.
- Page: "Agent SDK overview". URL: https://code.claude.com/docs/en/agent-sdk/overview.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."
- Second quote: "Use of the Claude Agent SDK is governed by Anthropic's Commercial Terms of Service"

**RT-05.** Claude Code has a non-interactive mode: `claude -p "prompt"` runs once with no person typing and exits with a success or failure code, so any scheduler (cron, launchd, a CI system) can call it.
- Page: "Run Claude Code programmatically". URL: https://code.claude.com/docs/en/headless.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Add the -p (or --print) flag to any claude command to run it non-interactively."

**RT-06.** Non-interactive runs can authenticate with the subscription today: `claude setup-token` creates a one-year token tied to the subscription, intended for scripts and CI. That token cannot fetch connectors configured in claude.ai; only locally configured MCP servers work with it.
- Page: "Authentication", section "Generate a long-lived token". URL: https://code.claude.com/docs/en/authentication.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "This token authenticates with your Claude subscription and requires a Pro, Max, Team, or Enterprise plan. It can only make model requests, so it can't establish Remote Control sessions or fetch claude.ai connectors. MCP servers you configure locally still work."

**RT-07.** A warning for any design that leans on `claude -p` with the subscription: Anthropic recommends "bare mode" for scripted calls, bare mode does not use the subscription login (it needs an API key), and the docs say bare mode will become the default for `-p` in a future release. No date is given.
- Page: "Run Claude Code programmatically", section "Start faster with bare mode". URL: https://code.claude.com/docs/en/headless.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "--bare is the recommended mode for scripted and SDK calls, and will become the default for -p in a future release."
- Second quote: "Set ANTHROPIC_API_KEY before running it, because bare mode doesn't use your subscription login"

**RT-08.** For unattended runs there is a documented switch that denies anything that would normally ask a person for permission, rather than hanging. Permission rules, hooks and the permission mode still decide each call first.
- Page: "Run Claude Code programmatically", section "Turn off permission prompts in unattended runs". URL: https://code.claude.com/docs/en/headless.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Pass --permission-prompts none when nobody is available to answer permission prompts, for example in a scheduled job."

**RT-09.** The headless page documents no maximum run length for a `claude -p` run. What it does document: a spend cap flag (`--max-budget-usd`) and a default 10 minute cap on waiting for leftover background work after the main turn ends.
- Page: "Run Claude Code programmatically", section "Background tasks at exit". URL: https://code.claude.com/docs/en/headless.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Claude Code stops whatever is still running after 10 minutes of continuous idle waiting by default and drops its partial result."

**RT-10.** Cloud sessions (Claude Code running on Anthropic's servers) always bill to the subscription, never to an API key. Unattended local sessions stop when the stored login expires, until a person signs in again.
- Page: "Authentication", sections "Authentication precedence" and "Renew an expiring login". URL: https://code.claude.com/docs/en/authentication.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Cloud sessions always use your subscription credentials. If you set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN in the cloud environment, it doesn't override your subscription credentials."
- Second quote: "A background session in agent view or a Remote Control session that outlives the login stops making progress once the credential expires and can't recover until you sign in again."

**Method note added during the run.** From RT-11 onward most pages were fetched with `curl` and the matching lines were read directly, so those quotes are verbatim page text (trimmed for length, dashes replaced with hyphens). RT-01 to RT-10 came through the summarizing fetch tool, which returned those documentation pages in full as raw text, so those quotes are also verbatim.

**RT-11.** Current rule, dated the day before this research: on a Max plan, the Agent SDK, `claude -p` and third-party apps may still run on the subscription and draw from the normal subscription limits. A change announced earlier in 2026 that would have moved them to a separate credit was paused on June 15, 2026. This area changed twice in four months, so treat it as unstable.
- Page: "Use the Claude Agent SDK with your Claude plan" (Claude Help Center, "Updated yesterday"). URL: https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan
- Accessed: 2026-10-08. Strength: A.
- Quote: "Update October 7, 2026: Claude Max and Team plans now include monthly API credits, which cover the Claude Agent SDK, claude -p, the Claude API, and Claude Managed Agents. You can still use the Claude Agent SDK, claude -p, and third-party apps with your subscription limits."
- Second quote: "Update June 15, 2026: We've paused the previously-announced changes to Claude Agent SDK usage. For now, nothing has changed"

**RT-12.** New on October 7, 2026: Max plans include a monthly API credit, 100 US dollars on Max 5x and 200 US dollars on Max 20x. It is claimed by linking a Claude Console organization, needs seven days on the plan, does not roll over, and when it runs out API requests stop unless credits are bought. It is never charged to the plan. Pro is not eligible.
- Page: "Monthly API credits for Max and Team plans" (Claude Help Center). URL: https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "If the organization has no other credits, API requests stop until your next monthly credits arrive. Usage is never charged to your Claude plan."
- Table text seen: "Max 5x $100", "Max 20x $200". Also: "Doesn't roll over. Unused credits expire at the end of each billing cycle."

**RT-13.** What the monthly API credit covers and does not: it covers the Claude API, Managed Agents, the Agent SDK and `claude -p` when run with an API key from the linked Console organization. It does not cover interactive Claude Code, extra usage, or runs started by the Claude Code GitHub Action, an IDE extension or the desktop app.
- Page: "Monthly API credits for Max and Team plans", FAQ "Does this cover claude -p?". URL: https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
- Accessed: 2026-10-08. Strength: A.
- Quote: "When you're signed in with your Claude plan instead, claude -p and Agent SDK usage still draw from your plan's usage limits and don't use your API credits. Runs started by the Claude Code GitHub Action, an IDE extension or the Claude desktop app count as Claude Code usage"

**RT-14.** Max plan tiers and prices: Max 5x is 100 US dollars a month, Max 20x is 200 US dollars a month, monthly billing only.
- Page: "What is the Max plan?" (Claude Help Center, "Updated yesterday"). URL: https://support.claude.com/en/articles/11049741-what-is-the-max-plan
- Accessed: 2026-10-08. Strength: A. Price label: published. Cross-check: https://claude.com/pricing shows "Max ... From $100 Per month".
- Quote: "Max 5x : $100 per month. Max 20x : $200 per month. The Max plan is currently available as a monthly subscription only."

**RT-15.** How Max limits work: a session limit that resets every five hours, a weekly limit across all models, and a separate weekly limit for the Fable model. Anthropic reserves the right to add other caps. No token or message numbers are published on these pages.
- Page: "What is the Max plan?". URL: https://support.claude.com/en/articles/11049741-what-is-the-max-plan
- Accessed: 2026-10-08. Strength: A.
- Quote: "Your session-based usage limit will reset every five hours. Max plans also have a weekly usage limit that applies across all models."
- Second quote: "we may limit your usage in other ways, such as weekly and monthly caps or model and feature usage, at our discretion."

**RT-16.** The limits are one shared pool: everything done in the Claude apps and in Claude Code counts against the same limits. Cloud sessions and routines draw from the same pool too (see RT-19, RT-22). So an agent that runs all day competes with the owner's own interactive use.
- Page: "Use Claude Code with your Pro or Max plan". URL: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Accessed: 2026-10-08. Strength: A.
- Quote: "These limits are shared across Claude and Claude Code, meaning all activity in both tools counts against the same limits."

**RT-17.** If an API key is present in the environment, Claude Code uses it instead of the subscription and bills at API rates. This is the switch between "subscription" and "pay as you go" for local runs.
- Page: "Use Claude Code with your Pro or Max plan". URL: https://support.claude.com/en/articles/11145838-use-claude-code-with-your-pro-or-max-plan
- Accessed: 2026-10-08. Strength: A.
- Quote: "If you have an ANTHROPIC_API_KEY environment variable set on your system, Claude Code will use this API key for authentication instead of your Claude subscription ... resulting in API usage charges rather than using your subscription's included usage."

**RT-18.** Routines are Claude Code's cloud scheduler. They run on Anthropic's servers, so the laptop can be closed. Available on Pro, Max, Team and Enterprise. Labelled research preview.
- Page: "Automate work with routines". URL: https://code.claude.com/docs/en/routines
- Accessed: 2026-10-08. Strength: A.
- Quote: "Routines execute on Anthropic-managed cloud infrastructure ... so they keep working when your laptop is closed."
- Second quote: "Routines are in research preview. Behavior, limits, and the API surface may change."

**RT-19.** Routine schedule floor: one hour. Anything more frequent is rejected. Runs scheduled exactly on the hour can start several minutes late. Routines draw down subscription usage like interactive sessions.
- Page: "Automate work with routines", sections "Add a schedule trigger" and "Usage and limits". URL: https://code.claude.com/docs/en/routines
- Accessed: 2026-10-08. Strength: A.
- Quote: "The minimum interval is one hour; expressions that run more frequently are rejected."
- Second quote: "Routines draw down subscription usage the same way interactive sessions do."

**RT-20.** Routines can be started by an outside event: each routine can have its own web address that starts a run when another system sends it an authenticated request (an HTTP POST with a bearer token), with optional free text. Each fire starts a brand-new session. Caps: 30 fires per hour per routine and 100 per hour per account, no overage. The endpoint is experimental.
- Page: "Automate work with routines", sections "Add an API trigger" and "Usage and limits". URL: https://code.claude.com/docs/en/routines
- Accessed: 2026-10-08. Strength: A.
- Quote: "POSTing to the endpoint with the routine's bearer token starts a new session and returns a session URL."
- Second quote (table): "Run now, API fires, and setting a one-off routine to run again | 30 per hour | Each routine". "API fires | 100 per hour | Your account". "None of these hourly limits has overage."

**RT-21.** Routines run with no permission prompts at all, and by default every connector on the account is included with write access. A routine holding a broker connector could place orders without asking.
- Page: "Automate work with routines", section "Create a routine". URL: https://code.claude.com/docs/en/routines
- Accessed: 2026-10-08. Strength: A.
- Quote: "all of your connected MCP connectors are included by default. Remove any the routine doesn't need: Claude can use every tool from an included connector, including writes, without asking for permission during a run."

**RT-22.** Routines and cloud sessions can use connectors configured in claude.ai. MCP servers added only on the local machine are not available to them unless declared in a `.mcp.json` file committed to the repository or added as a claude.ai connector. Outbound network access from a cloud session is limited to an allowlist by default, and all traffic goes through an HTTP/HTTPS proxy.
- Page: "Automate work with routines", sections "Connectors" and "Environments and network access". URL: https://code.claude.com/docs/en/routines
- Accessed: 2026-10-08. Strength: A.
- Quote: "MCP servers you added locally in the CLI with claude mcp add are stored on your machine rather than your claude.ai account, so they do not appear in the connectors list."
- Second quote (cloud-environments page, https://code.claude.com/docs/en/cloud-environments.md): "Cloud sessions in Anthropic-hosted environments run behind an HTTP/HTTPS network proxy for security and abuse prevention purposes"

**RT-23.** Cloud session machine and limits: a fresh virtual machine each session (4 vCPUs, 16 GB RAM, 30 GB disk), no separate charge, counts toward plan limits. Sessions stop after "a period of inactivity" (no number given) and the machine is reclaimed. A single shell command can run about 2 to 10 minutes in the foreground, then up to 30 more minutes in the background. No overall maximum session length is stated.
- Pages: "Use Claude Code in the cloud" https://code.claude.com/docs/en/claude-code-on-the-web.md and "Configure cloud environments" https://code.claude.com/docs/en/cloud-environments.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "It counts toward your plan's usage limits alongside the rest of your Claude and Claude Code usage, and there's no separate charge for the cloud VM."
- Second quote: "Cloud sessions stop after a period of inactivity and the session's VM is reclaimed."

**RT-24.** The three Claude Code schedulers compared, from Anthropic's own table. Cloud routines: laptop not needed, minimum 1 hour. Desktop scheduled tasks: laptop must be on, minimum 1 minute, survive restarts. `/loop` inside a session: laptop on and session open, minimum 1 minute.
- Page: "Schedule recurring tasks in Claude Code Desktop", section "Compare scheduling options". URL: https://code.claude.com/docs/en/desktop-scheduled-tasks.md
- Accessed: 2026-10-08. Strength: A.
- Quote (table rows): "Requires machine on | No | Yes | Yes". "Minimum interval | 1 hour | 1 minute | 1 minute".

**RT-25.** Desktop scheduled tasks skip runs when the Mac sleeps, and closing the lid sleeps it. Each task also starts a few minutes after its scheduled time on purpose. After waking, only one catch-up run happens.
- Page: "Schedule recurring tasks in Claude Code Desktop". URL: https://code.claude.com/docs/en/desktop-scheduled-tasks.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Tasks only run while the desktop app is running and your computer is awake. If your computer sleeps through a scheduled time, the run is skipped. ... Closing the laptop lid still puts it to sleep."
- Second quote: "Each task gets a small delay of a few minutes after the scheduled time to stagger API traffic."
- Third quote (on demand): "Manual: no schedule, only runs when you click Run now."

**RT-26.** `/loop` tasks inside a session expire after 7 days and one session holds at most 50. They are not a durable scheduler.
- Page: "Run prompts on a schedule". URL: https://code.claude.com/docs/en/scheduled-tasks.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Recurring tasks automatically expire 7 days after creation." and "A session can hold up to 50 scheduled tasks at once."

**RT-27.** Cowork scheduled tasks (the Claude desktop app's non-coding side) now run remotely, so they run with the computer asleep or the app closed. Cadence options are hourly, daily, weekly, weekdays or manual, so the floor is hourly. Available on all paid plans. A task that needs local files or apps runs only locally.
- Page: "Schedule recurring tasks in Claude Cowork" (Claude Help Center, "Updated this week"). URL: https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-claude-cowork
- Accessed: 2026-10-08. Strength: A.
- Quote: "Scheduled tasks run remotely, so they run on their cadence even when your computer is asleep or the Claude Desktop app is closed."
- Second quote: "How frequently the task will run (hourly, daily, weekly, on weekdays, or manually)"

**RT-28.** Channels let an outside event (a chat message, a webhook, a monitoring alert) be pushed into a Claude Code session that is already running. Events only arrive while that session is open, so an always-on setup needs a process that stays running somewhere. Research preview.
- Page: "Push events into a running session with channels". URL: https://code.claude.com/docs/en/channels.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Events only arrive while the session is open, so for an always-on setup you run Claude in a background process or persistent terminal."

**RT-29.** Claude Code in GitHub Actions can run on a cron schedule and can authenticate either with an API key or with a subscription token (Pro, Max, Team, Enterprise). Schedule limits are GitHub's, see Part 2.
- Page: "Claude Code GitHub Actions". URL: https://code.claude.com/docs/en/github-actions.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "CLAUDE_CODE_OAUTH_TOKEN: an OAuth token that authenticates with your Claude subscription, available on Pro, Max, Team, and Enterprise plans."
- Second quote: "With a prompt input, the Claude Code GitHub Action runs in automation mode on any GitHub event, including a cron schedule."

**RT-30.** Hooks are not a trigger from outside. They are code (a shell command, a web request, and so on) that Claude Code runs at fixed points inside a session, for example before a tool call, where a hook can block it. Useful as a deterministic safety gate in front of an order tool.
- Page: "Hooks reference". URL: https://code.claude.com/docs/en/hooks.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Hooks are user-defined shell commands, HTTP endpoints, MCP tool calls, LLM prompts, or subagents that execute automatically at specific points in Claude Code's lifecycle."
- Table row: "PreToolUse | Before a tool call executes. Can block it"

**RT-31.** Claude Code memory across runs: each session starts with an empty context. Two built-in carriers exist: CLAUDE.md files that the owner writes, and "auto memory" notes Claude writes, stored on the local machine under the home folder. Because auto memory is a local folder, a cloud routine (fresh clone each run) would only see memory that is committed to the repository or held in an outside store.
- Page: "How Claude remembers your project". URL: https://code.claude.com/docs/en/memory.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Each Claude Code session begins with a fresh context window. Two mechanisms carry knowledge across sessions"
- Second quote: "Each project gets its own memory directory at ~/.claude/projects/<project>/memory/."
- Note: the last sentence of the claim is my inference from this quote plus RT-24 ("Access to local files | No (fresh clone)"). It was not stated on a page.

**RT-32.** How Claude Code reaches outside services: MCP servers, either remote (over HTTP, recommended) or local (a process on the machine). Connectors added in claude.ai appear automatically in Claude Code when signed in with the same account. The official directory is at https://claude.ai/directory.
- Page: "Connect Claude Code to tools via MCP". URL: https://code.claude.com/docs/en/mcp.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "If you've logged into Claude Code with a claude.ai account, MCP servers you've added in claude.ai, known as connectors, are automatically available in Claude Code"
- Second quote: "Browse reviewed connectors in the Anthropic Directory. Directory connectors use the same MCP infrastructure as Claude Code"

**RT-33.** Consumer Terms (which govern a Max plan): automated or scripted access is prohibited unless through an API key "or where we otherwise explicitly permit it". Anthropic's docs do explicitly document `claude -p`, routines, scheduled tasks and the subscription token (RT-06, RT-11, RT-18), which is the permission a subscription-driven agent would rest on.
- Page: "Consumer Terms of Service" (Effective October 8, 2025). URL: https://www.anthropic.com/legal/consumer-terms
- Accessed: 2026-10-08. Strength: A.
- Quote: "Except when you are accessing our Services via an Anthropic API Key or where we otherwise explicitly permit it, to access the Services through automated or non-human means, whether through a bot, script, or otherwise."
- Note: the reading in the second sentence of the claim is my interpretation, not a statement by Anthropic.

**RT-34.** Consumer Terms: the user agrees not to rely on the service or its actions to buy or sell securities. This sits in the list of prohibited uses. It bears directly on an agent that places orders on a Max plan.
- Page: "Consumer Terms of Service" (Effective October 8, 2025). URL: https://www.anthropic.com/legal/consumer-terms
- Accessed: 2026-10-08. Strength: A.
- Quote: "To rely upon the Services, the Materials, or the Actions to buy or sell securities or to provide or receive advice about securities, commodities, derivatives, or other financial products or services, as Anthropic is not a broker-dealer or a registered investment adviser"

**RT-35.** Usage Policy (applies to all plans and the API). Two versions matter, and the page at the main address shows the one that is NOT yet in force.
- In force on the access date (version marked "Effective September 15, 2025"): finance, including investment advice, is a "High-Risk Use Case". The requirement is a human-in-the-loop: a qualified professional must review advice, recommendations or decisions "directly affecting individuals or consumers" before they are finalized. The section is framed around consumer-facing use.
- Takes effect November 12, 2026 (the version now shown at the main address): a "personalized recommendation to buy, sell, hold, or allocate among specific investment products" is a high-risk recommendation. A qualified person must meaningfully review it before it is used to implement a decision. Exclusions include internal research and analysis that is not the final recommendation, and "carrying out a decision a person has already made, or applying a fixed rule, formula, or algorithm where the model exercises no judgment".
- Both versions say agentic use must comply with the policy. Neither version, as read, says whether the review requirement applies when the only person affected is the account holder (see Not verified).
- Pages: "Usage Policy" https://www.anthropic.com/legal/aup (shown as "Effective November 12, 2026") and its "Previous Version" link https://www.anthropic.com/legal/archive/22742366-2ef0-4c7a-a833-6523f10d3944 (shown as "Effective September 15, 2025").
- Accessed: 2026-10-08. Strength: A.
- Quote, in force now: "Human-in-the-loop: When using our products or services to provide advice, recommendations, or in subjective decision-making directly affecting individuals or consumers, a qualified professional in that field must review the content or decision prior to dissemination or finalization."
- Quote, in force now: "Finance: Use cases related to financial decisions, including investment advice, loan approvals, and determining financial eligibility or creditworthiness"
- Quote, from November 12, 2026: "Finance - a personalized recommendation to buy, sell, hold, or allocate among specific investment products, such as securities, funds, digital assets, or annuities"
- Quote, from November 12, 2026: "A qualified person must meaningfully review a High-risk AI Recommendation, with the authority to change or modify it, before it is delivered as advice to an individual who might rely on it or before it is used to implement a decision."
- Quote, from November 12, 2026: "Agentic use cases must comply with the Usage Policy. Users are responsible for ensuring that agents they build or deploy, including actions those agents take through tools, browsers, or connected systems, comply with this Usage Policy."

**RT-36.** Claude API prices seen on Anthropic's pricing page, in US dollars per million tokens (MTok), input / output: Fable 5.1 10 / 50, Opus 5.5 4 / 20, Sonnet 5.5 2 / 10, Haiku 5.5 0.10 / 0.50 for prompts up to 100K tokens (0.50 / 2.50 above). Cache read / cache write (5 minute): Fable 0.25 / 12.50, Opus 0.20 / 5, Sonnet 0.10 / 2.50, Haiku 0.01 / 0.125. Batch processing saves 50 percent.
- Page: "Pricing" (Claude). URL: https://claude.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Opus 5.5 ... Prompt caching Read $0.20 / MTok Write $5 / MTok Input $4 / MTok Output $20 / MTok" and "Save 50% with batch processing."
- Caution: text was extracted from the page's HTML with tags stripped, so label and number order was reconstructed. Re-open in a browser before relying on a number.

**RT-37.** Managed Agents exists as an Anthropic-hosted agent service on the API: standard token rates plus 0.08 US dollars per session-hour of active runtime. Web search tool: 10 US dollars per 1,000 searches.
- Page: "Pricing" (Claude), section "Pricing for Claude Platform features". URL: https://claude.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Managed Agents ... Standard token rates apply. Cost $0.08 per session-hour for active runtime"

**RT-38.** Platform docs confirm the API prices in RT-36 and add: 1 hour cache writes cost 2 times base input (Opus 5.5: 8 US dollars per MTok), cache hits on Opus 5.5 and Sonnet 5.5 are 0.05 times base input, and the Batch API gives 50 percent off input and output (Opus 5.5 batch: 2 / 10).
- Page: "Pricing" (Claude Platform docs). URL: https://platform.claude.com/docs/en/about-claude/pricing.md
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "The Batch API allows asynchronous processing of large volumes of requests with a 50% discount on both input and output tokens."
- Table row: "Claude Opus 5.5 | $4 / MTok | $5 / MTok | $8 / MTok | $0.20 / MTok | $20 / MTok" (base input, 5m cache write, 1h cache write, cache hit, output).

**RT-39.** Managed Agents (beta, API billing, not the subscription) can run an agent on a cron schedule with granularity down to one minute, with Anthropic hosting the run. It also sends webhooks outward when a session changes state.
- Page: "Scheduled deployments" (Claude Platform docs, status beta). URL: https://platform.claude.com/docs/en/managed-agents/scheduled-deployments.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "In the schedule, you define a cron expression and a timezone. Maximum granularity supported is at the minute level."
- Not checked: whether Managed Agents can be started by an inbound web callback other than a normal API call to create a session, and its maximum session length.

**RT-40.** Managed Agents memory: each session starts fresh; "memory stores" (beta) are document collections mounted as a folder so memory survives across sessions.
- Page: "Memory stores" (Claude Platform docs, status beta). URL: https://platform.claude.com/docs/en/managed-agents/memory.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Each Managed Agents session starts with a fresh context by default. ... Memory stores let the agent carry information across sessions"

**RT-41.** The API memory tool is client-side: Claude asks for file operations and the owner's own software carries them out against storage the owner controls (a folder or a database). Anthropic stores nothing. So with self-running software, memory lives wherever that software puts it.
- Page: "Memory tool" (Claude Platform docs). URL: https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "The memory tool operates client-side: Claude requests file operations, and your application executes them. You control where and how the data is stored through your own infrastructure."

**RT-42.** The public connector directory is at https://claude.com/connectors, which redirects to https://claude.com/marketplace/connectors-plugins. A "Financial services" category label is visible in the page source, along with a few market-data style entries. The full list did not render without a browser. https://claude.ai/directory returned HTTP 403 to a plain fetch.
- Page: connector marketplace. URL: https://claude.com/marketplace/connectors-plugins
- Accessed: 2026-10-08. Strength: A (existence of the directory and category only).
- Text seen: "Financial services", "Category". Detailed browse left to the other session.

**RT-43.** Anthropic's browser agent (Claude in Chrome) is prohibited from executing trades regardless of permissions. This is specific to that product; it shows Anthropic's stance but is not a statement about connectors or the API.
- Page: "Claude in Chrome permissions guide". URL: https://support.claude.com/en/articles/12902446-claude-in-chrome-permissions-guide
- Accessed: 2026-10-08. Strength: A.
- Quote: "To protect you, Claude is prohibited from taking following actions regardless of permissions: Making purchases or financial transactions; Providing investment or financial advice; Executing financial trades or investment transactions"

**RT-44.** Anthropic's own advice for scheduled Cowork tasks is not to schedule tasks that make purchases or take hard-to-undo actions.
- Page: "Use Claude Cowork safely" ("Updated this week"). URL: https://support.claude.com/en/articles/13364135-use-claude-cowork-safely
- Accessed: 2026-10-08. Strength: A.
- Quote: "Don't schedule tasks that access sensitive files, send messages on your behalf, make purchases, or take other actions that are difficult to undo."

### Part 2: places self-running software could live

**RT-45.** Vercel cron (scheduled job) limits: Hobby allows a job to run at most once per day, with timing accurate only to the hour. Pro allows once per minute with per-minute precision. More frequent expressions on Hobby fail at deployment. This rules Hobby out for any intraday schedule.
- Page: "Usage & Pricing for Cron Jobs" (Vercel docs). URL: https://vercel.com/docs/cron-jobs/usage-and-pricing.md
- Accessed: 2026-10-08. Strength: A.
- Quote (table): "Hobby | 100 cron jobs | Once per day | Per-hour (+-59 min)". "Pro | 100 cron jobs | Once per minute | Per-minute".
- Second quote: "Expressions like 0 * * * * (per-hour) or */30 * * * * (every 30 minutes) will fail deployment"

**RT-46.** Vercel function run length: Hobby 300 seconds maximum. Pro 300 seconds default, 800 seconds maximum, 1800 seconds "extended maximum" in beta. Memory: Hobby 2 GB, Pro 4 GB.
- Page: "Vercel Functions Limits" (Vercel docs). URL: https://vercel.com/docs/functions/limitations.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Hobby: 300s default and maximum. Pro and Enterprise: 300s default, 800s maximum, and 1800s extended maximum Beta."

**RT-47.** Vercel Hobby is restricted to non-commercial personal use, and "commercial" is defined as any deployment used for the financial gain of anyone involved in producing it. Whether a private trading tool for the owner's own account counts is not answered on the page; Vercel says to ask support if unsure.
- Page: "Fair use Guidelines", section "Commercial usage" (Vercel docs). URL: https://vercel.com/docs/limits/fair-use-guidelines.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Hobby teams are restricted to non-commercial personal use only."
- Second quote: "Commercial usage is defined as any Deployment that is used for the purpose of financial gain of anyone involved in any part of the production of the project"

**RT-48.** Vercel functions cannot hold an always-open connection. WebSocket support exists (public beta, all plans) but every connection is cut when the function hits its maximum duration (RT-46), so a live price stream would drop every 5 to 13 minutes and need reconnecting. The feature is described for clients connecting in to the function; the page does not describe a function staying up to listen to an outside stream.
- Page: "Do Vercel Functions support WebSocket connections?" (Vercel knowledge base). URL: https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- Accessed: 2026-10-08. Strength: A.
- Quote: "Duration: A connection closes when the function reaches its maximum duration, so every client needs reconnect logic."

**RT-49.** Vercel functions run in Washington DC (`iad1`) by default. The region is changed in the project settings in the dashboard or with the `regions` setting in `vercel.json`. Hobby runs in a single region; Pro can set several.
- Page: "Configuring regions for Vercel Functions" (Vercel docs). URL: https://vercel.com/docs/functions/configuring-functions/region.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "By default, Vercel Functions execute in Washington, D.C., USA (iad1) for all new projects"
- Second quote: "You can define the region in your vercel.json using the regions setting"

**RT-50.** Vercel prices: Hobby is free and includes 4 CPU-hours and 1,000,000 function invocations a month. Pro is a 20 US dollar monthly platform fee that includes 20 US dollars of usage credit, with usage beyond that billed on demand.
- Pages: "Vercel Hobby Plan" https://vercel.com/docs/plans/hobby.md and "Vercel Pro Plan" https://vercel.com/docs/plans/pro-plan.md
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "$20/month Pro platform fee" and "$20/month in usage credit". Hobby: "The Hobby plan is free and aimed at developers with personal projects"

**RT-51.** Supabase Pro costs 25 US dollars a month per organization and includes 10 US dollars of compute credit, which covers exactly one project on the smallest paid size (Micro; Nano is billed as Micro in a paid organization). Credits reset monthly.
- Page: "Manage Compute usage" (Supabase docs). URL: https://supabase.com/docs/guides/platform/manage-your-usage/compute.md
- Accessed: 2026-10-08. Strength: A. Price label: published. Cross-check: https://supabase.com/pricing shows "Paid plans include $10/mo in compute credits, enough to cover one Micro instance."
- Quote: "Paid plans include $10 in Compute Credits, which cover one project running on the Micro/Nano Compute size or portions of other Compute sizes."
- Table rows seen: "Pro Plan | - | $25", "Compute Credits | | -$10".

**RT-52.** Every additional Supabase project is its own database server and adds compute cost: about 10 US dollars a month at Micro (0.01344 per hour). So a second project for sib-tech in an existing Pro organization that already uses its credit would add roughly 10 US dollars a month.
- Page: "Compute and Disk" (Supabase docs). URL: https://supabase.com/docs/guides/platform/compute-and-disk.md
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote (table): "Micro | $0.01344 | ~$10 | Shared | 1 GB | 10 GB". "Small | $0.0206 | ~$15 | Shared | 2 GB".
- Second quote (billing page, https://supabase.com/docs/guides/platform/billing-on-supabase.md): "Caution: Each project you launch increases your monthly Compute costs."
- Note: whether the owner's existing organization has already used its credit is not something this run could measure. The "roughly 10 dollars" is arithmetic from the table, not a quote.

**RT-53.** Supabase Edge Functions (small programs Supabase hosts) are short-lived: a worker stays alive at most 400 seconds on paid plans (150 on free), with 256 MB memory, 2 seconds of actual processor time per request, and a 150 second limit to send a response.
- Page: "Limits" (Supabase Edge Functions docs). URL: https://supabase.com/docs/guides/functions/limits.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Maximum Duration (Wall clock limit): ... Free plan: 150s. Paid plans: 400s". "Maximum Memory: 256MB". "Maximum CPU Time: 2s".

**RT-54.** Supabase Edge Functions can open outgoing WebSocket connections, but because the worker lives at most 400 seconds (RT-53) they cannot hold an always-open stream. The second half is my inference from the two pages together.
- Page: "Handling WebSockets" (Supabase docs). URL: https://supabase.com/docs/guides/functions/websockets.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Establish both incoming and outgoing WebSocket connections"

**RT-55.** Supabase Cron (the pg_cron extension, scheduled jobs inside the database) can run as often as every second. A job can run database code or make a web request, for example to call an Edge Function. Guidance: no more than 8 jobs at once, each under 10 minutes.
- Page: "Cron" (Supabase docs). URL: https://supabase.com/docs/guides/cron.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "can run anywhere from every second to once a year depending on your use case."
- Second quote: "we recommend no more than 8 Jobs run concurrently. Each Job should run no more than 10 minutes."

**RT-56.** Supabase Realtime pushes messages and database changes to connected clients (Broadcast, Presence, Postgres Changes). It is for clients listening to the database, not for the database listening to a market data stream. Pro includes 500 peak connections. US regions include us-west-2 (Oregon), us-west-1, us-east-1 and us-east-2.
- Pages: "Realtime" https://supabase.com/docs/guides/realtime.md, "Billing on Supabase" https://supabase.com/docs/guides/platform/billing-on-supabase.md, "Available regions" https://supabase.com/docs/guides/platform/regions.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "Postgres Changes: Listen to database changes in real-time." Table: "Realtime Peak Connections | 200 | 500 included, then $10 per 1000". Regions: "West US (Oregon), us-west-2".

**RT-57.** GitHub Actions schedules: the shortest interval is every 5 minutes, runs can be delayed when GitHub is busy (the top of every hour is named as a busy time, and queued jobs may even be dropped), and schedules only run from the default branch. Quotes re-checked verbatim with curl against the page body.
- Page: "Events that trigger workflows", section "schedule" (GitHub Docs). URL: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Accessed: 2026-10-08. Strength: A.
- Quote: "The shortest interval you can run scheduled workflows is once every 5 minutes."
- Second quote: "The schedule event can be delayed during periods of high loads of GitHub Actions workflow runs. High load times include the start of every hour. If the load is sufficiently high enough, some queued jobs may be dropped."
- Third quote: "Scheduled workflows run on the latest commit on the default branch."

**RT-58.** The rule that switches off schedules after 60 days of no repository activity is worded as applying to public repositories. The page body, read verbatim with curl, contains no matching sentence for private repositories. The owner's repository is private, so on this wording the rule does not reach it, but that is a reading of silence, not a statement by GitHub.
- Page: "Events that trigger workflows", section "schedule" (GitHub Docs). URL: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Accessed: 2026-10-08. Strength: A.
- Quote: "In a public repository, scheduled workflows are automatically disabled when no repository activity has occurred in 60 days."

**RT-59.** GitHub Free includes 2,000 Actions minutes and 500 MB of artifact storage a month for private repositories. Standard runners on public repositories are free. Beyond the allowance a 2-core Linux runner costs 0.006 US dollars a minute. Arithmetic, not a quote: a 2 minute job every 5 minutes across a 6.5 hour trading day is 156 minutes a day, about 3,300 minutes over 21 trading days, which exceeds the free allowance.
- Page: "GitHub Actions billing" (GitHub Docs). URL: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote (table, via summarizing fetch): GitHub Free: "500 MB" artifact storage, "2,000" minutes per month. "GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners."

**RT-60.** A GitHub Actions job on a GitHub-hosted runner can run up to 6 hours. So a single job could in principle hold a connection open for most of a trading session, but it is a build system, not a server, and each started job spends minutes from the allowance (360 minutes for one 6 hour job).
- Page: "Actions limits" (GitHub Docs). URL: https://docs.github.com/en/actions/reference/limits
- Accessed: 2026-10-08. Strength: A.
- Quote (re-checked verbatim with curl): "Each job in a workflow can run for up to 6 hours of execution time. If a job reaches this limit, the job is terminated and fails."
- Not checked: whether GitHub's terms allow using Actions as a general-purpose long-running compute service. See the Not verified list.

**RT-61.** Cloudflare Workers pricing: a free plan with 100,000 requests a day and 10 milliseconds of processor time per run, and a paid plan with a minimum of 5 US dollars a month per account that includes 10 million requests and 30 million CPU milliseconds.
- Page: "Pricing" (Cloudflare Workers docs). URL: https://developers.cloudflare.com/workers/platform/pricing/index.md
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "The Workers Paid plan includes Workers, Pages Functions, Workers KV, Hyperdrive, and Durable Objects usage for a minimum charge of $5 USD per month for an account."
- Table row: "Free | 100,000 per day | No charge for duration | 10 milliseconds of CPU time per invocation".

**RT-62.** Cloudflare Workers schedules (Cron Triggers) can fire every minute, in UTC. Processor time per scheduled run on the paid plan: 30 seconds when the schedule is more frequent than hourly, 15 minutes when hourly or less often. Time spent waiting on the network does not count as processor time. Free plan: 5 cron triggers per account and 10 ms CPU; paid: 250.
- Pages: "Limits" https://developers.cloudflare.com/workers/platform/limits/index.md and "Cron Triggers" https://developers.cloudflare.com/workers/configuration/cron-triggers/index.md
- Accessed: 2026-10-08. Strength: A.
- Quote (table): "CPU time per Cron Trigger | 10 ms | 30 seconds (< 1 hour interval), 15 min (>= 1 hour interval)".
- Second quote: "Waiting on network requests (such as fetch() calls, KV reads, or database queries) does not count toward CPU time." Cron page example: "At every minute". "Cron Triggers execute on UTC time."

**RT-63.** Cloudflare Durable Objects (small always-addressable programs with their own storage) can open an outgoing WebSocket to another server, which is what listening to a price stream needs. But the cost-saving sleep mode ("hibernation") only works for incoming connections, so an object holding an outgoing stream is billed for the whole time it is connected. Paid plan includes 400,000 GB-seconds of duration a month, then 12.50 US dollars per million. Durable Objects are available on the free plan with the SQLite storage type, with 13,000 GB-seconds a day.
- Pages: "Use WebSockets" https://developers.cloudflare.com/durable-objects/best-practices/websockets/index.md and "Pricing" https://developers.cloudflare.com/durable-objects/platform/pricing/index.md
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Hibernation is only supported when a Durable Object acts as a WebSocket server. Outgoing WebSockets do not hibernate."
- Second quote (table): "Duration | 13,000 GB-s / day | 400,000 GB-s / month, + $12.50/million GB-s".
- Not found on these pages: a guarantee of how long an object holding an outgoing connection stays alive without being restarted. See the Not verified list.

**RT-64.** Fly.io: the smallest always-on machine (shared CPU, 256 MB RAM) is 2.19 US dollars a month, billed by the second while running; 512 MB is 3.69, 1 GB is 6.70.
- Page: "Fly.io Resource Pricing" (Fly.io docs). URL: https://fly.io/docs/about/pricing/
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Started Machine, shared-cpu-1x with 256MB RAM $2.19/month Smallest Machine size. Billed by the second while running"

**RT-65.** DigitalOcean: the smallest Droplet (virtual server) is 4.00 US dollars a month for 512 MiB RAM, 1 vCPU, 10 GiB disk.
- Page: "Droplet Pricing" (DigitalOcean). URL: https://www.digitalocean.com/pricing/droplets
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote (table row, tags stripped): "512 MiB 1 vCPU 500 GiB 10 GiB $0.00595 $ 4.00" (memory, vCPU, transfer, disk, hourly, monthly).
- Second quote, showing it is billed as a machine that runs all month (DigitalOcean docs, https://docs.digitalocean.com/products/droplets/details/pricing/): "Droplets are billed per second with a minimum charge of 60 seconds or $0.01, whichever is higher. Usage is capped at 672 hours (28 days) per month."

**RT-66.** Render: the free web service tier spins down after 15 minutes with no inbound traffic, so it is not always-on. The cheapest paid instance is 7 US dollars a month (512 MB RAM).
- Pages: "Deploy for Free" https://render.com/docs/free and "Pricing" https://render.com/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Render spins down a Free web service that goes 15 minutes without receiving any inbound traffic."
- Pricing row (tags stripped): "Less than 1 CPU $7/month 512 MB RAM".

**RT-67.** Railway: a Free plan with 1 US dollar of credit a month and a Hobby plan at 5 US dollars a month, where the fee counts toward usage.
- Page: "Pricing Plans" (Railway docs). URL: https://docs.railway.com/reference/pricing/plans
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "Free $0 / month. Hobby $5 / month." and "The subscription fee goes towards your usage-costs on the platform."

**RT-68.** AWS Lightsail: the cheapest Linux server is 5 US dollars a month with a public IPv4 address (0.5 GB memory) or 3.50 with IPv6 only. Quote came through the summarizing fetch tool.
- Page: "Amazon Lightsail pricing". URL: https://aws.amazon.com/lightsail/pricing/
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "$5 USD/mo", "0.5 GB Memory", "20 GB SSD Disk"; IPv6 only: "$3.50 USD/mo", "512 MB Memory".

**RT-69.** Hetzner has US data centers in Hillsboro, Oregon and Ashburn, Virginia. Its prices did not render without a browser, so no price is recorded. Price label: gated and unverified (rendering, not a login).
- Page: "Cloud" (Hetzner). URL: https://www.hetzner.com/cloud
- Accessed: 2026-10-08. Strength: A.
- Quote: "You also benefit from servers in Hillsboro, Oregon, and Ashburn, Virginia, in North America."

**RT-70.** The owner's Mac, scheduled jobs: Apple's (archived) developer guide says a launchd job set for a calendar time that falls while the Mac is asleep runs once when the Mac wakes, not at the scheduled time. Other launchd jobs and cron jobs are skipped. If the Mac is off, the job waits for the next time. So nothing scheduled runs on time on a sleeping Mac.
- Page: "Scheduling Timed Jobs" (Apple Developer, documentation archive). URL: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/ScheduledJobs.html
- Accessed: 2026-10-08. Strength: A (archived, may be out of date for current macOS).
- Quote: "If you schedule a launchd job by setting the StartCalendarInterval key and the computer is asleep when the job should have run, your job will run when the computer wakes up."

**RT-71.** The owner's Mac, staying awake: macOS has a setting to prevent automatic sleep on the power adapter when the display is off, and the `pmset` command can schedule a wake time. Apple's page does not say that any setting keeps a MacBook running with the lid closed. Anthropic's own doc says closing the lid still sleeps the machine (RT-25).
- Pages: "Set sleep and wake settings for your Mac" https://support.apple.com/guide/mac-help/set-sleep-and-wake-settings-mchle41a6ccd/mac and "Schedule your Mac to turn on or off in Terminal" https://support.apple.com/guide/mac-help/schedule-your-mac-to-turn-on-or-off-mchl40376151/mac
- Accessed: 2026-10-08. Strength: A.
- Quote: "Stop automatic sleeping when the display is off: Turn on 'Prevent automatic sleeping on power adapter when the display is off.'"
- Second quote: "sudo pmset repeat wake M 8:00:00: Schedule your Mac to wake at 8:00 a.m. every Monday."

### Part 3: hosted trading-automation platforms

**RT-72.** QuantConnect tier prices from its own machine-readable pricing page: Free 0, Researcher 84 US dollars a month (888 a year), Team 168 a month. The Free tier has no live trading (live trading node limit 0, no paper trading). Researcher allows up to 2 live trading nodes. The price of a live trading node itself was not present in the page text.
- Page: "QuantConnect Pricing" (markdown version). URL: https://www.quantconnect.com/pricing.md
- Accessed: 2026-10-08. Strength: A. Price label: published for tier prices; gated and unverified for live node prices (page needs a browser, not a login).
- Quote: "Free - $0/month. Researcher - $84/month ($888/year). Team - $168/month ($1,728/year) - min 2, max 10 users"
- Table rows: "Live Trading Node Limit | 0 | 2 | 10 | Unlimited | Unlimited". "Paper Trading | - | yes | yes | yes | yes" (check marks written as "yes").
- Note: 888 a year works out to 74 a month, an ordinary annual discount against 84 billed monthly. Third-party reviews in search results gave different numbers. See Contradictions.

**RT-73.** QuantConnect needs one live trading node per live algorithm, running on its own co-located servers. The smallest model listed is L-MICRO (1 core, 0.5 GB RAM).
- Page: "Resources" (QuantConnect docs). URL: https://www.quantconnect.com/docs/v2/cloud-platform/organizations/resources
- Accessed: 2026-10-08. Strength: A.
- Quote: "You need a live trading node for each algorithm that you deploy to our co-located servers."

**RT-74.** QuantConnect live trading brokerages for US stocks listed in its docs: Interactive Brokers, TradeStation, Tastytrade, Public, Alpaca, Charles Schwab and Tradier, plus its own paper trading.
- Page: "Brokerages" (QuantConnect docs). URL: https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/brokerages
- Accessed: 2026-10-08. Strength: A.
- Text seen (navigation list): "QuantConnect Paper Trading, Interactive Brokers, TradeStation, Tastytrade, Public, Alpaca, Charles Schwab, Tradier".

**RT-75.** QuantConnect models cash accounts separately from margin accounts (a cash buying power model), and has settlement models including delayed settlement that the brokerage model sets automatically. The pages fetched did not state the exact settlement delay applied to US stocks in a cash account.
- Pages: "Alpaca" brokerage model https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/brokerages/supported-models/alpaca and "Settlement, Key Concepts" https://www.quantconnect.com/docs/v2/writing-algorithms/reality-modeling/settlement/key-concepts
- Accessed: 2026-10-08. Strength: A.
- Quote: "The AlpacaBrokerageModel uses the CashBuyingPowerModel for cash accounts, the SecurityMarginModel for margin accounts"
- Second quote: "The brokerage model of your algorithm automatically sets the settlement model for each security, but you can override it."

**RT-76.** QuantConnect data: the Free tier includes minute to daily resolution data; second and tick resolution need the Researcher tier.
- Page: "Tier Features" (QuantConnect docs). URL: https://www.quantconnect.com/docs/v2/cloud-platform/organizations/tier-features
- Accessed: 2026-10-08. Strength: A.
- Quote: "The free data ranges from minute to daily resolutions" and "In Quant Researcher organizations, members can use second and tick resolution data from the Datasets Market."

**RT-77.** QuantConnect has an official MCP server that lets an AI model create projects, run backtests and deploy live algorithms. Claude Code is listed as a supported client. The remote (hosted) version requires a paid "agent node".
- Page: "MCP Server, Key Concepts" (QuantConnect docs). URL: https://www.quantconnect.com/docs/v2/ai-assistance/mcp-server/key-concepts
- Accessed: 2026-10-08. Strength: A.
- Quote: "This server equips the LLM with tools to create projects, run backtests, deploy live algorithms, and more."
- Second quote: "To use the remote MCP server, your organization must have a paid agent node, such as an A1-1, A4-8, or A16-32 node."

**RT-78.** Composer ("Composer by SoFi") is a no-code platform for building and auto-trading rule-based strategies called symphonies. Prices: Starter 0, Advanced 10 US dollars a month, Pro 32 a month billed yearly (384 a year). API access is on Pro. Quotes came through the summarizing fetch tool.
- Page: "Pricing" (Composer). URL: https://www.composer.trade/pricing
- Accessed: 2026-10-08. Strength: A. Price label: published.
- Quote: "No subscription needed to start automated trading." and Pro: "Get full API access to pull data, run backtests, and trade through your strategies"

**RT-79.** Composer accounts sit with Composer Securities LLC as broker-dealer, carried and cleared by Alpaca Securities LLC and Apex Clearing Corporation.
- Page: "Pricing" (Composer), footer disclosure. URL: https://www.composer.trade/pricing
- Accessed: 2026-10-08. Strength: A.
- Quote (re-checked verbatim with curl): "Securities products and brokerage services are offered by Composer Securities LLC, a broker-dealer registered with the SEC and member of FINRA / SIPC."
- Second quote: "Accounts are carried and securities execution, clearance and settlement services are provided by Alpaca Securities LLC, and Apex Clearing Corporation, SEC-registered broker-dealers and members of FINRA / SIPC."

**RT-80.** Composer is not an intraday platform: automated trades happen once a day in a fixed window, 3:45 PM to 4:00 PM Eastern. Manual "Buy Now / Sell Now" can trade outside the window.
- Page: "Trading Period" (Composer Knowledge Center). URL: https://help.composer.trade/article/63-trading-period
- Accessed: 2026-10-08. Strength: A.
- Quote: "On normal market days, Composer's trading period is from 3:45 PM to 4:00 PM Eastern Time."

**RT-81.** Composer has a public API with documentation ("to build automated trading strategies"). An MCP server for Composer was reported only by a third-party directory in search results; it was not confirmed on a Composer page in this run.
- Page: "Welcome to the Composer API!". URL: https://api.composer.trade/docs/index.html
- Accessed: 2026-10-08. Strength: A (API). MCP claim: not verified.
- Quote: "This documentation provides information on how to integrate with the Composer API to build automated trading strategies."

**RT-82.** TradingView alerts can send a web callback (webhook, an HTTP POST) to any address when an alert fires. Requirements: two-factor authentication on, only ports 80 and 443, and the receiving server must answer within three seconds. So a TradingView alert can act as the "event" that starts something else, but the receiver must be fast. Quotes came through the summarizing fetch tool.
- Page: "How to configure webhook alerts" (TradingView support). URL: https://www.tradingview.com/support/solutions/43000529348-how-to-configure-webhook-alerts/
- Accessed: 2026-10-08. Strength: A.
- Quote: "If a remote server takes longer than three seconds to process a request, the request will be cancelled."
- Second quote: "webhook alerts are only allowed when 2-factor authentication is enabled."

**RT-83.** TradingView plan prices seen (billed annually, shown as "special price"): Basic 0, Essential 12.95 US dollars a month, Plus 29.95, Premium 59.95, Ultimate 199.95. Which plan first includes webhook notifications could not be read from the page text.
- Page: "Pricing" (TradingView). URL: https://www.tradingview.com/pricing/
- Accessed: 2026-10-08. Strength: A. Price label: published (promotional price, may differ from list price).
- Quote: "Essential: Special price: $12.95 / mo" (via summarizing fetch).

**RT-84.** Brokers shown on TradingView's brokers page that serve US stock traders include Interactive Brokers, TradeStation, Fidelity Investments, Alpaca, Public, tastytrade, Tradier, Webull and moomoo. These are for placing orders by hand from the chart. This run found no TradingView page saying that an alert can place a broker order by itself.
- Page: "Top Brokers" (TradingView). URL: https://www.tradingview.com/brokers/
- Accessed: 2026-10-08. Strength: A.
- Text seen: "Interactive Brokers Platinum", "TradeStation Platinum", "Fidelity Investments Silver", "Alpaca Silver", "Public Silver", "Tradier Brokerage Silver".

**RT-85.** Other platform surfaced: Alpaca (a broker with an API) documents its own MCP server. It defaults to paper (simulated) trading and switches to live trading with one setting. It can be limited to chosen toolsets, for example read-only market data. It runs locally (Python).
- Page: "Trading MCP Server" (Alpaca docs). URL: https://docs.alpaca.markets/us/docs/alpaca-mcp-server
- Accessed: 2026-10-08. Strength: A.
- Quote (table row): "ALPACA_PAPER_TRADE | No | true | Set false to use live trading"
- Second quote: "Control which tools are available to your AI assistant using ALPACA_TOOLSETS. This is useful for limiting scope (e.g. read-only market data)"

### Added after review

**RT-86.** GitHub Actions can be started on demand and by an outside event: a "Run workflow" button, the GitHub API or command line (`workflow_dispatch`), and an API call for activity outside GitHub (`repository_dispatch`).
- Page: "Events that trigger workflows" (GitHub Docs). URL: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- Accessed: 2026-10-08. Strength: A.
- Quote: "You can use the GitHub API to trigger a webhook event called repository_dispatch when you want to trigger a workflow for activity that happens outside of GitHub."
- Second quote: "To enable a workflow to be triggered manually, you need to configure the workflow_dispatch event."

**RT-87.** A Managed Agents session is started by an API call, so own software or any outside system able to make that call can start one on demand.
- Page: "Start a session" (Claude Platform docs, beta). URL: https://platform.claude.com/docs/en/managed-agents/sessions.md
- Accessed: 2026-10-08. Strength: A.
- Quote: "You can create a session and start its work in one call." Example on the page posts to "https://api.anthropic.com/v1/sessions".

**RT-88.** A QuantConnect live algorithm runs on QuantConnect's servers, receives real-time market data there, and keeps running after the owner closes the editor. Automatic restarts can be configured.
- Page: "Deployment" (QuantConnect docs, live trading). URL: https://www.quantconnect.com/docs/v2/cloud-platform/live-trading/deployment
- Accessed: 2026-10-08. Strength: A.
- Quote: "Deploy your trading algorithms live to receive real-time market data and submit orders on our co-located servers racked in Equinix." and "Since the algorithms run in QuantConnect Cloud, you can close the IDE without interrupting the execution of your algorithms."

**RT-89.** Cowork work counts against the plan's usage limit, and multi-step tasks and auto mode use more of it. No single sentence seen says "Cowork and Claude Code share one pool", but the API credit article lists the three together ("your usage limits in Claude, Claude Code, or Claude Cowork", RT-12 page).
- Page: "Get started with Claude Cowork" (Claude Help Center). URL: https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork
- Accessed: 2026-10-08. Strength: A.
- Quote: "Multi-step tasks, like ones that run code, create files, or use your connected apps and browser, use more of your usage than a quick question."
- Second quote: "auto mode consumes more of your usage limit than the other modes"

## 2. Per-platform summary table

Built only from the findings above. "Stream" means holding an always-open connection to listen to live prices. "Callback" means it can only be woken by a web request from somewhere else. Costs are monthly, in US dollars.

| Platform | Schedule (smallest interval) | React to an event | On demand | Where memory can live | Longest single run | Monthly cost |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Claude Code cloud routines | Yes, 1 hour (RT-19) | Callback only: API trigger starts a new session, 30 per hour per routine (RT-20). No stream. | Yes, "Run now" or API call (RT-20) | Files committed to the repository, or an outside store reached by a connector. Local auto memory is not available (RT-22, RT-31) | Not stated. Stops after unspecified inactivity (RT-23) | Inside the Max plan, 100 or 200, shared with all other use (RT-14, RT-16, RT-19) |
| Claude Code Desktop scheduled tasks | Yes, 1 minute, with a deliberate delay of a few minutes (RT-24, RT-25) | No outside trigger found | Yes, "Run now" (RT-25) | Local files, CLAUDE.md, auto memory (RT-31) | Not verified | Inside the Max plan. Mac must be awake with lid open (RT-25) |
| Claude Code `/loop` in a session | Yes, 1 minute, expires after 7 days (RT-24, RT-26) | Channels can push events into an open session (RT-28) | Yes | Same as the session, local files (RT-31) | Session must stay open (RT-24) | Inside the Max plan. Mac must be awake |
| `claude -p` run by an outside scheduler | Whatever the scheduler allows (RT-05) | Whatever starts the command | Yes | Local files, or whatever the script uses (RT-31, RT-41) | No maximum documented (RT-09) | Max plan limits today (RT-11), or API rates with a key (RT-17, RT-36). Future default may need an API key (RT-07) |
| Cowork scheduled tasks | Yes, hourly (RT-27) | Not verified | Yes, manual run (RT-27) | Connectors and files saved to the Claude account (RT-27) | Not verified | Inside the Max plan, counts against its usage limit (RT-14, RT-89) |
| Claude Code in GitHub Actions | Yes, 5 minutes, can be delayed (RT-29, RT-57) | GitHub events and an API dispatch call (RT-29, RT-86) | Yes (RT-86) | Files in the repository | 6 hours per job (RT-60) | Max plan or API, plus GitHub minutes (RT-29, RT-59) |
| Claude API or Agent SDK with an API key (own software) | Depends on the host below | Depends on the host below | Yes | Wherever the software stores it (RT-41) | Depends on the host | Pay per token (RT-36, RT-38). 100 or 200 monthly credit on Max (RT-12, RT-13) |
| Managed Agents (Anthropic hosted, beta) | Yes, 1 minute (RT-39) | Not verified | Yes, API call (RT-87) | Memory stores, beta (RT-40) | Not verified | Token rates plus 0.08 per session-hour (RT-37) |
| Vercel Hobby | Once per day, hour-level accuracy (RT-45) | Callback only. Connections cut at 300 seconds (RT-46, RT-48) | Yes, web request | An outside database | 300 seconds (RT-46) | 0. Non-commercial use only (RT-47, RT-50) |
| Vercel Pro | 1 minute (RT-45) | Callback only. Connections cut at 800 seconds, 1800 in beta (RT-46, RT-48) | Yes, web request | An outside database | 800 seconds, 1800 in beta (RT-46) | 20, includes 20 usage credit (RT-50) |
| Supabase (Pro) | 1 second via Cron inside the database, each job under 10 minutes (RT-55) | Callback only. Edge Function worker lives 400 seconds (RT-53, RT-54) | Yes, web request to an Edge Function | The Postgres database itself | 400 seconds wall clock, 2 seconds CPU per request (RT-53) | 25 with one Micro project covered. About 10 per extra project (RT-51, RT-52) |
| GitHub Actions (Free, private repo) | 5 minutes, can be delayed or dropped at busy times (RT-57) | Callback: GitHub events and an API dispatch call (RT-86). Stream: not verified, a job is capped at 6 hours (RT-60) | Yes (RT-86) | Files in the repository, or an outside store | 6 hours per job (RT-60) | 0 up to 2,000 minutes, then 0.006 per minute (RT-59) |
| Cloudflare Workers plus Durable Objects | 1 minute (RT-62) | Stream possible: a Durable Object can hold an outgoing WebSocket, billed while connected (RT-63). Uptime guarantee not verified | Yes, web request | Durable Object storage (RT-63) | 30 seconds CPU per frequent cron run, 15 minutes CPU if hourly or slower. Network wait not counted (RT-62) | 0 on free plan with tight limits, or 5 minimum (RT-61, RT-63) |
| Small always-on server | Not verified from a quoted page (a server runs whatever scheduler is installed on it) | Stream: not verified from a quoted page. Inference only: these are machines billed for running the whole month (RT-64, RT-65), and Render states its free tier is the one that spins down (RT-66) | Not verified from a quoted page | Not verified from a quoted page | Not verified. No run limit appears on the pricing pages seen (RT-64, RT-65) | Fly.io 2.19 (RT-64), DigitalOcean 4 (RT-65), Lightsail 3.50 to 5 (RT-68), Railway 5 (RT-67), Render 7 (RT-66), Hetzner not verified (RT-69) |
| The owner's Mac | launchd or cron while awake. Asleep: jobs run late on wake or are skipped (RT-70) | Stream: not verified from a quoted page. It could only run while awake with the lid open (RT-25, RT-71) | Yes, `claude -p` or any local command (RT-05) | Local files (RT-31) | Not verified. No limit documented for `claude -p` (RT-09) | 0 for the machine. Not from a quoted page |
| QuantConnect | Algorithm stays deployed on a live node in QuantConnect's cloud (RT-73, RT-88). In-algorithm schedule granularity not verified | Stream: its servers receive real-time market data for the algorithm (RT-88) | Via MCP server or web (RT-77) | Not verified | Not verified. Runs after the editor is closed, with optional automatic restarts (RT-88) | 84 Researcher tier plus a live node of unverified price (RT-72) |
| Composer | Once a day, 3:45 to 4:00 PM Eastern (RT-80) | No | Manual Buy Now / Sell Now (RT-80) | Not applicable | Not applicable | 0, 10 or 32 (RT-78) |
| TradingView alerts | Alerts are evaluated by TradingView; interval not checked | Sends a callback out, receiver must answer in 3 seconds (RT-82) | Not applicable | Not applicable | Not applicable | 12.95 and up; webhook plan not verified (RT-83) |

## 3. Not verified

1. **Whether Anthropic permits a personal, unattended, order-placing agent on a Max subscription.** The docs permit `claude -p`, routines and scheduled tasks on the plan (RT-06, RT-11, RT-18), say limits assume "ordinary, individual usage" (RT-02), and the Consumer Terms prohibit relying on the service to buy or sell securities (RT-34). No page seen reconciles these for a personal trading agent. Tried: Claude Code "Legal and compliance", the Agent SDK overview, Consumer Terms, Usage Policy, three Help Center articles. What would settle it: a written answer from Anthropic support.
2. **Whether the Usage Policy's qualified-human review requirement (RT-35) applies when the only person affected is the account owner.** The policy text speaks of advice "delivered to an individual" and decisions about an individual. Tried: reading the high-risk section and its exclusions. Not stated either way.
3. **Maximum length of a single cloud session or routine run, and the inactivity period before a cloud session expires.** The docs say "a period of inactivity" with no number (RT-23). Tried: claude-code-on-the-web, cloud-environments, routines pages.
4. **Actual size of Max plan limits in tokens, messages or hours.** Not published on the pages seen (RT-15). Tried: "What is the Max plan?", "Use Claude Code with your Pro or Max plan", claude.com/pricing.
5. **When bare mode becomes the default for `claude -p`** (RT-07). No date on the page.
6. **Whether Cowork scheduled tasks can be started by an outside event, and their run-length limit.** Tried: the Cowork scheduling help article.
7. **Managed Agents: inbound triggers other than an API call, maximum session length, and whether it reaches claude.ai connectors.** Only the overview, scheduled-deployments, webhooks and memory pages were sampled.
8. **Whether GitHub's inactivity rule disables schedules in private repositories.** The doc text returned names public repositories only (RT-58). Tried: the "Events that trigger workflows" page through the summarizing fetch.
9. **Whether GitHub's terms allow Actions as a general long-running compute host for a trading bot.** Not searched beyond the limits page.
10. **How long a Cloudflare Durable Object holding an outgoing WebSocket stays up before the platform restarts it.** Tried: Durable Objects WebSockets, pricing and limits pages.
11. **Hetzner cloud server prices.** Prices did not render in fetched text (RT-69). Tried: hetzner.com/cloud with curl and hetzner.com/cloud/regular-performance with the fetch tool.
12. **QuantConnect live trading node prices.** Not in the text of pricing.md or the pricing page (RT-72). Tried: quantconnect.com/pricing (fetch tool and curl), pricing.md, docs "Resources". Third-party figures in search results disagreed with each other, so the price is labelled gated and unverified.
13. **QuantConnect: the settlement delay modelled for US stocks in a cash account.** Tried: settlement key concepts, supported models, Alpaca and Interactive Brokers brokerage model pages (RT-75).
14. **Composer MCP server.** Reported by a third-party directory in search results (strength C or D, not fetched). The guessed repository URL github.com/invest-composer/composer-trade-mcp returned 404 and composer.trade/mcp returned 404. Not confirmed on a Composer page.
15. **Which TradingView plan first includes webhook alerts.** The pricing page text lost the per-plan marks (RT-83). A search snippet of an older TradingView blog post said "paid users only"; that page was not opened in this run.
16. **Whether a TradingView alert can place an order at a connected broker without outside software.** No page found saying so (RT-84).
17. **Vercel Hobby and a personal trading tool.** Whether trading the owner's own account is "financial gain" under Vercel's commercial-use definition is not answered on the page (RT-47).
18. **Finance connectors in the official directory.** Only the category label was seen (RT-42). Left to the other session by instruction.
19. **A single Anthropic sentence stating that Cowork, the desktop app and Claude Code all draw from one shared limit pool.** RT-16 covers "Claude and Claude Code"; RT-89 shows Cowork counts against "your usage limit". Tried: "What is the Max plan?", "Use Claude Code with your Pro or Max plan", "Get started with Claude Cowork".
20. **Always-on servers: that a small server can hold a market data stream all day, and any run limits.** Not quoted from a vendor page in this run. The table marks these cells as inference.

## 4. Needs browser

- https://claude.ai/directory (HTTP 403 to a plain fetch)
- https://claude.com/marketplace/connectors-plugins (connector list only partly present in page source)
- https://www.quantconnect.com/pricing (tier and node prices drawn by scripts)
- https://www.hetzner.com/cloud and https://www.hetzner.com/cloud/regular-performance (prices drawn by scripts)
- https://www.tradingview.com/pricing/ (per-plan feature marks for "Webhook notifications")
- https://claude.com/pricing (worth a visual check of the model price table, since RT-36 was reconstructed from stripped HTML; RT-38 confirms the numbers from a second Anthropic page)

## 5. Contradictions between sources

1. **Agent SDK and `claude -p` billing on subscriptions.** A web search summary, drawing on third-party pages, stated that from June 15, 2026 Agent SDK and `claude -p` usage moved off subscription limits onto a separate monthly credit (20 on Pro, 100 on Max 5x, 200 on Max 20x). Anthropic's live Help Center article says that change was paused on June 15, 2026 and that the different credit launched October 7, 2026 is an API credit, "not the same" as the June one (RT-11, RT-12). The vendor page, seen live and updated the day before, is taken as correct. Third-party articles on this topic are likely stale.
2. **Bare mode versus subscription use.** The Help Center says `claude -p` still runs on the plan (RT-11). The Claude Code docs say bare mode, which cannot use the plan login, "will become the default for -p in a future release" (RT-07). Not a direct conflict today, but they point in different directions for the future.
3. **Cowork scheduled tasks and a sleeping computer.** The current help article says tasks run remotely even when the computer is asleep (RT-27). A search summary reported that older Anthropic pages (an Academy tutorial and a desktop configuration reference) still say the computer must be awake and the app open. Those older pages were not opened in this run. The help article is marked "Updated this week" and mentions an October 6 cutover, so it is taken as current.
4. **QuantConnect prices.** QuantConnect's pricing.md says Researcher is 84 a month (RT-72). Third-party reviews surfaced in search gave 60 a month and other figures (strength C, not opened). The vendor figure is used.
5. **Composer trading window.** The Knowledge Center says 3:45 PM to 4:00 PM Eastern (RT-80). A search summary reported the Composer homepage FAQ as saying 3:50 PM to close. The homepage FAQ text was not confirmed in this run.
6. **launchd on a sleeping Mac.** Apple's archived guide says a missed calendar job runs on wake (RT-70). A search summary reported a developer forum post claiming newer Macs run the job while asleep (strength D, not opened). Apple's guide is archived and may not match current macOS. A measurement would settle it: schedule a job, close the lid, read the log.
7. **Usage Policy versions.** Not a conflict between sources but between dates: the page at the main address shows the version effective November 12, 2026, while the version in force on the access date is the one effective September 15, 2025 (RT-35). The older text ties the human review requirement to advice or decisions "directly affecting individuals or consumers" and frames the section as consumer-facing. The newer text names personalized buy, sell or hold recommendations directly and adds explicit exclusions. Any stack decision that outlives November 12, 2026 should be read against the newer text.

