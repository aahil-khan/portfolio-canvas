![A dark dashboard titled aahil-server, with tiles grouped as Core Services, Developer Tools, Monitoring, Automation and Jobs, Media, Links and Projects.](/lab/demo/old-laptop/essay-old-laptop-1.webp "w=800 h=455 | My home server dashboard — everything I run lives here.")

:::side[Where this ran.]
This essay first ran on Medium[^medium], and is reproduced here in full with its images. One screenshot has an IP address blurred.
:::

At the time, I didn’t see any real benefit. It was just something fun and nerdy to try.

But building my [[t:home-server|home server]] ended up being one of the best engineering decisions I’ve made. Today, that old laptop:

- Runs 50+ services
- Acts as my testing environment
- Hosts microservices, databases, and APIs
- Has a full observability stack
- Saves me [[t:vps|VPS]] costs
- And has taught me more DevOps and Linux than any course

This is the story of how I built it.

## Hardware & Base Setup

My “cloud” is an HP Pavilion x360 Convertible:

- Intel i5–8250U (quad-core)
- 16 GB RAM
- 500GB NVMe + 1TB SSD
- NVIDIA MX130 GPU
- Ubuntu 24.04 LTS

### What I learned early

At first, I ran everything in [[t:tmux|tmux]] sessions. Then my house had frequent power cuts.

I lost every running service.

That’s when I learned the hard way:

Use [[t:systemd|systemd]], not tmux, for persistent services.

Today, every important component runs through systemd.

## My Hosting & Security Philosophy

My server is secure by default because nothing is publicly accessible unless I explicitly expose it.

### Access paths

1\. [[t:cloudflare-access|Cloudflared Access TCP]]

- Uses Cloudflared login first
- This is how I SSH from my laptop

2\. [[t:tailscale|Tailscale]] (mesh VPN)

- Backup remote access
- Works even if Cloudflared or DNS fails

3\. [[t:cloudflare-tunnel|Cloudflared tunnels]] for hosting

- I expose a Docker port
- Route it through Cloudflared
- Map it to a subdomain on my domain
- A systemd service keeps the tunnel alive

Unless I expose something myself, nobody can even discover the machine.

This was a huge confidence boost while [[tag:self-hosting|self-hosting]].

## My SSH Shell Setup

![A terminal logged in to aahil-server: swap, temperature and process counts, Ubuntu update notices, and a custom prompt on the last line. The IPv6 address is blurred.](/lab/demo/old-laptop/essay-old-laptop-2.webp "w=800 h=448")

My customized SSH shell — this is how I usually connect to the server when I’m working locally or through Cloudflared Access.

## How I Actually Use My Home Server Daily

### 1. Testing all my official projects locally

I run my production-grade work here before deploying:

- SkillMap
- Portana
- Intellidine
- Edutube
- Many experiments and prototypes

This saves me cloud costs and makes testing much faster.

### 2. Running all my backend APIs locally

I deploy frontends to Vercel, but all backends run here.

It’s faster, cheaper, and I can develop in peace without burning VPS hours.

### 3. Self Hosting Tools

I run several tools that help me automate, orchestrate, or extend my workflow:

- [[t:n8n|n8n]] — my automation workflow engine (webhooks, API chaining, background tasks)
- [[t:jellyfin|Jellyfin]] — occasional media server
- [[t:transmission|Transmission daemon]] — rarely used now, but integrated with my Telegram bot
- [[t:ollama|Ollama]] — local LLM inference engine

Most of these run inside [[t:docker|Docker]] for easy management and isolation.

### 4. Debugging with real DevOps tools

I use:

- [[t:dashy|Dashy]] as my homepage
- [[t:portainer|Portainer]] for container management
- [[t:dozzle|Dozzle]] for streaming logs
- [[t:glances|Glances]] and [[t:netdata|Netdata]] for system metrics
- [[t:uptime-kuma|Uptime Kuma]] for uptime alerts
- [[t:healthchecks|Healthchecks]] for cron monitoring

This setup feels like running my own mini cloud.

### 5. Using MySQL

I’ve hosted public test databases for projects, and it’s extremely convenient for development.

### 6. Rarely — Jellyfin & downloads

I have a media server hosted through Jellyfin and a telegram bot to download torrents and files. I don’t use these too much, but they’re great to have.

## Container Management — Docker Everywhere

![Portainer’s container list: a column of running containers with their stacks, images, creation dates and IP addresses.](/lab/demo/old-laptop/essay-old-laptop-3.webp "w=800 h=436 | Portainer Dashboard")

### Why Portainer?

Because it gives me:

- Resource usage per container
- Start/stop/restart
- exec into containers
- Volume/network visibility
- Stack deployments

It’s simply the best GUI for managing a Docker-heavy server.

## Real-Time Logs With Dozzle

![Dozzle in the browser: a list of hosts and containers on the left, and a live stream of request logs from a backend on the right.](/lab/demo/old-laptop/essay-old-laptop-4.webp "w=800 h=438 | Dozzle Dashboard")

Perfect for debugging microservices or watching events in real time.

Especially when something misbehaves.

## System Monitoring With Glances and Netdata

![Glances in a terminal: CPU, memory, swap and load bars across the top, network and disk rates down the side, and a table of 28 containers with their CPU and memory use.](/lab/demo/old-laptop/essay-old-laptop-5.webp "w=800 h=435 | Glances Dashboard")

![Netdata’s system overview: dials for disk reads and writes, CPU and RAM use, and network traffic, above smaller pressure and load charts.](/lab/demo/old-laptop/essay-old-laptop-6.webp "w=800 h=439 | Netdata")

I can see:

- CPU
- RAM
- Disk I/O
- Network traffic
- Processes
- Container usage

All in one place.

## Uptime Monitoring

![Uptime Kuma’s dashboard: nine services up and none down, each with its uptime percentage, above a table of recent checks and their responses.](/lab/demo/old-laptop/essay-old-laptop-7.webp "w=800 h=436 | Uptime Kuma Dashboard")

Every service is tracked. If something fails, I get notified instantly.

## The Telegram Bot — My Failsafe

![A Telegram chat with the aahil-server bot: the message “stats” and its reply with uptime, CPU, memory and disk usage.](/lab/demo/old-laptop/essay-old-laptop-8.webp "w=800 h=219 | Telegram Web")

This was one of the first things I wrote — a simple Bash script + Telegram API + Transmission daemon.

Even today, it acts as my:

- emergency download tool
- server status helper

If every other layer breaks, this bot still works.

## n8n

![An n8n workflow on its canvas: a chain of connected nodes that reads tasks and sends reminders through Telegram.](/lab/demo/old-laptop/essay-old-laptop-9.webp "w=800 h=313 | A custom n8n workflow to remind tasks thorough telegram")

I’m still getting comfortable with n8n, but I’ve already begun using it for small workflow automations.

## Including a Fun ASCII Tool

One tool I recently tried is `ascii-view`,[^ascii] which transforms images into really clean ASCII art.

![A photo of a red rose beside the same photo rendered in coloured ASCII characters.](/lab/demo/old-laptop/essay-old-laptop-10.webp "w=800 h=401")

I didn’t make it myself — just found it interesting, so I’ve linked the official GitHub repo for anyone curious.

## DevOps Skills I Picked Up

Running this server taught me:

- how to manage microservices
- Docker networking and healthchecks
- systemd service files
- log streaming and debugging
- [[t:reverse-proxy|reverse proxies]]
- Linux hardening
- cron monitoring
- database hosting
- cost-efficient deployment
- Cloudflared tunnels
- uptime management
- VPN-based security

This was better than any formal DevOps course.

## Why You Should Build a Home Server

If you’re even a little curious about self-hosting, building a home server is absolutely worth it. You don’t need fancy hardware — an old laptop and a bit of curiosity are more than enough. You’ll learn real DevOps skills, understand how systems behave in the real world, and gain confidence that no tutorial can match. It becomes your own little cloud: a place to host projects, experiment freely, break things safely, and grow as a developer. If you’ve been thinking about it, take the leap — you’ll be surprised by how much you learn.

## Conclusion — The Best Engineering Decision I Made

What started as a fun experiment became:

- my backend environment
- my microservices lab
- my hosting platform
- my personal cloud
- my DevOps university

This old laptop now powers everything from production-grade services to AI workloads — and it has saved me countless hours and costs.

If you’re even thinking about building a home server:

Do it. You’ll learn more than you expect. And it might just become the most important machine you own.
