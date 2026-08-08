import { describe, it, expect } from 'vitest'

const COMMAND_SUGGESTIONS = [
  { cmd: 'help', desc: 'View list of available commands', usage: 'help [command]' },
  { cmd: 'op', desc: 'Grant operator status to a player', usage: 'op <player>' },
  { cmd: 'deop', desc: 'Revoke operator status from a player', usage: 'deop <player>' },
  { cmd: 'whitelist', desc: 'Manage server whitelist', usage: 'whitelist <add|remove|list|on|off|reload>' },
  { cmd: 'ban', desc: 'Ban a player from the server', usage: 'ban <player> [reason]' },
  { cmd: 'kick', desc: 'Kick a player from the server', usage: 'kick <player> [reason]' },
  { cmd: 'gamemode', desc: 'Set player game mode', usage: 'gamemode <survival|creative|adventure|spectator> [player]' },
  { cmd: 'difficulty', desc: 'Set game difficulty', usage: 'difficulty <peaceful|easy|normal|hard>' },
  { cmd: 'weather', desc: 'Set the weather', usage: 'weather <clear|rain|thunder> [duration]' },
  { cmd: 'time', desc: 'Change or query world time', usage: 'time <set|add|query> <value>' },
  { cmd: 'gamerule', desc: 'Set or query a game rule value', usage: 'gamerule <rule> [value]' },
  { cmd: 'tp', desc: 'Teleport players or coordinates', usage: 'tp [target] <destination>' },
  { cmd: 'give', desc: 'Give an item to a player', usage: 'give <player> <item> [amount]' },
  { cmd: 'say', desc: 'Broadcast a message to all players', usage: 'say <message>' },
  { cmd: 'stop', desc: 'Gracefully save and stop the server', usage: 'stop' },
  { cmd: 'restart', desc: 'Restart the server process', usage: 'restart' },
  { cmd: 'reload', desc: 'Reload server configuration and datapacks', usage: 'reload' }
]

function getAutocompleteSuggestions(input) {
  const raw = input.trimStart()
  if (!raw) return []

  const clean = raw.startsWith('/') ? raw.slice(1) : raw
  const parts = clean.split(' ')
  const firstWord = parts[0].toLowerCase()

  if (parts.length === 1 && firstWord.length > 0) {
    return COMMAND_SUGGESTIONS.filter(item =>
      item.cmd.toLowerCase().startsWith(firstWord)
    )
  }
  return []
}

describe('Terminal Command Autocomplete Logic', () => {
  it('returns matching suggestions for prefixes without slash', () => {
    const results = getAutocompleteSuggestions('ga')
    expect(results).toHaveLength(2)
    expect(results.map(r => r.cmd)).toContain('gamemode')
    expect(results.map(r => r.cmd)).toContain('gamerule')
  })

  it('returns matching suggestions for prefixes with leading slash', () => {
    const results = getAutocompleteSuggestions('/wh')
    expect(results).toHaveLength(1)
    expect(results[0].cmd).toBe('whitelist')
    expect(results[0].usage).toBe('whitelist <add|remove|list|on|off|reload>')
  })

  it('returns empty array when command contains arguments after a space', () => {
    const results = getAutocompleteSuggestions('op player123')
    expect(results).toHaveLength(0)
  })

  it('returns empty array for empty or whitespace input', () => {
    expect(getAutocompleteSuggestions('')).toHaveLength(0)
    expect(getAutocompleteSuggestions('   ')).toHaveLength(0)
  })
})
