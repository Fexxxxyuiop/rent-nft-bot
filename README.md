# NFT RENT Telegram Bot

Telegram bot starter for an NFT gift rental catalog. Payments are arranged manually with the owner: the bot collects rental requests and sends them to admins; it does not create crypto invoices or automatically move NFTs.

## Features
- Russian-language catalog: NFT gifts, collectible usernames, Telegram +888 numbers
- Gift collection list and sample rental periods
- Request creation with item, period, and optional contact note
- SQLite request storage
- Admin notifications and admin panel to view requests and change status
- No collection of passwords, login codes, or account sessions

## Run
1. Create a bot using @BotFather.
2. Copy `.env.example` to `.env`.
3. Set `BOT_TOKEN`, `ADMIN_IDS` (comma-separated numeric Telegram user IDs), and optionally `OWNER_CONTACT`.
4. Install dependencies: `pip install -r requirements.txt`
5. Start: `python -m bot.main`

For GitHub hosting, add the files to a repository and use a host that supports a persistent Python worker. Configure the environment variables in the host dashboard. Free hosting may sleep or lose local files; use persistent storage for production.

## Manual payment flow
The bot records a request and notifies the admin. The owner contacts the renter to agree on payment and transfer terms, then manually marks the request as completed/rejected in the admin menu.
