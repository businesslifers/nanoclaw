# Remove Mattermost Channel

1. Comment out `import './mattermost.js'` in `src/channels/index.ts`
2. Remove `MATTERMOST_BASE_URL` and `MATTERMOST_BOT_TOKEN` from `.env`
3. `pnpm uninstall chat-adapter-mattermost`
4. Rebuild and restart
