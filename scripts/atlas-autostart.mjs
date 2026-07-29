import {
  autostartStatus,
  installAutostart,
  removeAutostart,
  runAutostartTaskNow,
} from './atlas-startup/autostart-win.mjs';

const command = process.argv[2] ?? 'status';
const runNow = process.argv.includes('--run');

async function main() {
  switch (command) {
    case 'install':
      installAutostart();
      break;
    case 'remove':
      removeAutostart();
      break;
    case 'status':
      await autostartStatus();
      break;
    case 'run':
      {
        const result = runAutostartTaskNow();
        if (!result.ok) {
          console.error(result.reason || result.output || 'Failed to run task');
          process.exit(1);
        }
        console.log('Scheduled task triggered manually.');
      }
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: node scripts/atlas-autostart.mjs <install|status|remove|run>');
      process.exit(1);
  }

  if (runNow && command === 'install') {
    const result = runAutostartTaskNow();
    if (result.ok) console.log('Scheduled task triggered for verification.');
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
