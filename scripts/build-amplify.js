const fs = require('fs/promises');
const path = require('path');

const rootDir = process.cwd();
const outputDir = path.join(rootDir, '.amplify-hosting');
const computeDir = path.join(outputDir, 'compute', 'default');

async function copyIntoCompute(sourceRelative, targetRelative = sourceRelative) {
  const source = path.join(rootDir, sourceRelative);
  const target = path.join(computeDir, targetRelative);
  await fs.cp(source, target, { recursive: true, force: true });
}

async function buildAmplifyBundle() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(computeDir, { recursive: true });

  await Promise.all([
    copyIntoCompute('server.js'),
    copyIntoCompute('public'),
    copyIntoCompute('data'),
    copyIntoCompute('package.json'),
    copyIntoCompute('package-lock.json'),
    copyIntoCompute('node_modules')
  ]);

  const manifest = {
    version: 1,
    framework: {
      name: 'express',
      version: '4.21.2'
    },
    routes: [
      {
        path: '/*',
        target: {
          kind: 'Compute',
          src: 'default'
        }
      }
    ],
    computeResources: [
      {
        name: 'default',
        runtime: 'nodejs22.x',
        entrypoint: 'server.js'
      }
    ]
  };

  await fs.writeFile(path.join(outputDir, 'deploy-manifest.json'), JSON.stringify(manifest, null, 2));
  // eslint-disable-next-line no-console
  console.log('Amplify bundle generated at .amplify-hosting/');
}

buildAmplifyBundle().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to build Amplify bundle', error);
  process.exit(1);
});
