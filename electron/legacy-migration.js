import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

/**
 * One-time data migration: if legacy %APPDATA%/IslandFocus store exists
 * and Beacon's store has no state, migrate tasks, notes, settings, and stats.
 */
export function runLegacyMigration(targetStore, logger = console.log) {
  try {
    const appData = app.getPath('appData')
    const legacyDir = path.join(appData, 'IslandFocus')
    const legacyFiles = [
      path.join(legacyDir, 'islandfocus.json'),
      path.join(legacyDir, 'config.json'),
    ]

    const existingTargetState = targetStore.get('state')
    if (existingTargetState && existingTargetState.tasks && existingTargetState.tasks.length > 0) {
      // Beacon store already has user data
      return false
    }

    for (const legacyPath of legacyFiles) {
      if (fs.existsSync(legacyPath)) {
        const raw = fs.readFileSync(legacyPath, 'utf8')
        const parsed = JSON.parse(raw)
        const stateToMigrate = parsed.state ?? parsed

        if (stateToMigrate && typeof stateToMigrate === 'object') {
          targetStore.set('state', stateToMigrate)
          if (typeof parsed.launchAtStartup === 'boolean') {
            targetStore.set('launchAtStartup', parsed.launchAtStartup)
          }
          logger('[migration] Successfully migrated data from legacy store to Beacon')
          return true
        }
      }
    }
  } catch (err) {
    logger('[migration] Legacy migration encountered an error (skipped): ' + String(err))
  }
  return false
}
