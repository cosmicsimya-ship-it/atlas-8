import {
  atlasRestart,
  atlasStart,
  atlasStatus,
  atlasStop,
  printStatusReport,
} from './manager.mjs';
import { isWindows } from './process-win.mjs';

const command = process.argv[2] ?? 'status';

async function main() {
  if (!isWindows()) {
    console.error('unsupported platform');
    process.exit(1);
  }

  switch (command) {
    case 'start':
      await atlasStart();
      break;
    case 'stop':
      await atlasStop();
      break;
    case 'status':
      printStatusReport(await atlasStatus());
      break;
    case 'restart':
      await atlasRestart();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Usage: node scripts/atlas-startup/cli.mjs <start|stop|status|restart>');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
